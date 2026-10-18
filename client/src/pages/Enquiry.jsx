
import React, { useState } from "react";

export default function Enquiry() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    program_id: "",
    message: "",
  });

  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function update(event) {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function validate() {
    const next = {};

    if (!form.full_name.trim())
      next.full_name = "Full name is required";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address";

    if (!form.phone.trim())
      next.phone = "Phone number is required";

    if (!form.address.trim())
      next.address = "Address is required";

    if (!form.program_id)
      next.program_id = "Select a program";

    return next;
  }

  async function submit(event) {
    event.preventDefault();

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length) return;

    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Enquiry could not be submitted");
      }

      setStatus("Enquiry submitted successfully.");
    } catch {
      setStatus("Unable to submit enquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto" }}>
      <h1>RIC Student Enquiry</h1>
      <p>Complete the form to enquire about a program.</p>

      <form onSubmit={submit} noValidate>
        {[
          ["full_name", "Full Name"],
          ["email", "Email"],
          ["phone", "Phone"],
          ["address", "Address"],
        ].map(([name, label]) => (
          <div key={name} style={{ marginBottom: 16 }}>
            <label htmlFor={name}>{label}</label>
            <input
              id={name}
              name={name}
              value={form[name]}
              onChange={update}
              aria-invalid={!!errors[name]}
              aria-describedby={errors[name] ? `${name}-error` : undefined}
              style={{ display: "block", width: "100%", padding: 8 }}
            />
            {errors[name] && (
              <p id={`${name}-error`} role="alert">
                {errors[name]}
              </p>
            )}
          </div>
        ))}

        <label htmlFor="program_id">Program</label>
        <select
          id="program_id"
          name="program_id"
          value={form.program_id}
          onChange={update}
          style={{ display: "block", width: "100%", padding: 8 }}
        >
          <option value="">Select a program</option>
        </select>
        {errors.program_id && <p role="alert">{errors.program_id}</p>}
        <p>Program options will load when the backend API is connected.</p>

        <label htmlFor="message">Message (Optional)</label>
        <textarea
          id="message"
          name="message"
          value={form.message}
          onChange={update}
          style={{ display: "block", width: "100%", padding: 8 }}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit Enquiry"}
        </button>

        {status && <p role="status">{status}</p>}
      </form>
    </main>
  );
}
