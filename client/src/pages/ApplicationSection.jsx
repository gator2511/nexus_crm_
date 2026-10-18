
import React, { useState } from "react";

export default function ApplicationSection() {
  const [form, setForm] = useState({
    qualification: "",
    institution: "",
    graduationYear: "",
  });
  const [document, setDocument] = useState(null);
  const [status, setStatus] = useState("");

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  function handleDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.type)) {
      setStatus("Only PDF, JPG and PNG files are accepted.");
      setDocument(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setStatus("Maximum file size is 10 MB.");
      setDocument(null);
      return;
    }

    setDocument(file);
    setStatus("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");

    if (!form.qualification || !form.institution) {
      setStatus("Complete all required fields.");
      return;
    }

    const token = localStorage.getItem("nexus_token");

    if (!token) {
      setStatus("Please log in before submitting.");
      return;
    }

    const data = new FormData();
    data.append("qualification", form.qualification);
    data.append("institution", form.institution);
    data.append("graduationYear", form.graduationYear);

    if (document) {
      data.append("document", document);
    }

    try {
      const response = await fetch("/api/student/application", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      if (!response.ok) {
        throw new Error("Application submission failed.");
      }

      setStatus("Application submitted successfully.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section style={{ marginTop: 30 }}>
      <h2>Student Application</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="qualification">Qualification</label>
          <input
            id="qualification"
            name="qualification"
            value={form.qualification}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="institution">Institution</label>
          <input
            id="institution"
            name="institution"
            value={form.institution}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="graduationYear">Graduation Year</label>
          <input
            id="graduationYear"
            name="graduationYear"
            type="number"
            value={form.graduationYear}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="document">Supporting Document</label>
          <input
            id="document"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleDocument}
          />
        </div>

        <button type="submit">Submit Application</button>
        {status && <p role="status">{status}</p>}
      </form>
    </section>
  );
}
