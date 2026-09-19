export const REQUEST_TYPES = ["regularize", "not_attending", "leave"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestDraft = {
  requestType: RequestType;
  sessionId?: string | null;
  dayDate: string;
  requestedPunchIn?: string | null;
  requestedPunchOut?: string | null;
  reason: string;
};

export function isRequestType(value: string): value is RequestType {
  return (REQUEST_TYPES as readonly string[]).includes(value);
}

export function validateRequestDraft(d: RequestDraft): string | null {
  const reason = d.reason.trim();
  if (reason.length < 8) return "Please explain in at least a short sentence.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dayDate)) return "Choose a valid date.";
  if (d.requestType === "regularize") {
    if (!d.sessionId) return "Choose the Sabha you need regularized.";
    if (!d.requestedPunchIn && !d.requestedPunchOut) {
      return "Enter the entry or exit time that should be recorded.";
    }
    if (d.requestedPunchIn && d.requestedPunchOut) {
      const a = new Date(d.requestedPunchIn);
      const b = new Date(d.requestedPunchOut);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "Those times are not valid.";
      if (b < a) return "Exit time cannot be before entry time.";
    }
  }
  if (d.requestType === "not_attending" && !d.sessionId) {
    return "Choose the Sabha you will miss.";
  }
  if (d.requestType === "leave" && !d.dayDate) {
    return "Choose the date you will be away.";
  }
  return null;
}

export function canSelfCancel(status: RequestStatus): boolean {
  return status === "pending";
}

export function canReview(status: RequestStatus): boolean {
  return status === "pending";
}
