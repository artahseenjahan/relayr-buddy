import { apiFetch } from "@/lib/apiClient";
import type { EmployeeProfileApi } from "@/types";

export interface EmployeeProfileInput {
  title: string;
  department: string;
  office_name: string;
  responsibilities_summary: string;
  role_guidelines_summary: string;
}

export async function getEmployeeProfile(): Promise<EmployeeProfileApi> {
  return apiFetch<EmployeeProfileApi>("/api/employee-profile");
}

export async function upsertEmployeeProfile(input: EmployeeProfileInput): Promise<EmployeeProfileApi> {
  return apiFetch<EmployeeProfileApi>("/api/employee-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
