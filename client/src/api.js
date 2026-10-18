
const API_BASE = "/api";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("nexus_token");

  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || "Request failed");
    error.status = response.status;
    error.details = data?.errors;
    throw error;
  }

  return data;
}

export function submitEnquiry(studentData) {
  return apiRequest("/enquiries", {
    method: "POST",
    body: JSON.stringify(studentData),
  });
}

export function studentLogin(credentials) {
  return apiRequest("/student/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function getStudentProfile() {
  return apiRequest("/student/me");
}
