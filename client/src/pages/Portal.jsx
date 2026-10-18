
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStudentProfile } from "../api.js";
import ApplicationSection from "./ApplicationSection.jsx";

export default function Portal() {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("nexus_token")) {
      navigate("/login", { replace: true });
      return;
    }

    getStudentProfile()
      .then(setStudent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  function logout() {
    localStorage.removeItem("nexus_token");
    navigate("/login", { replace: true });
  }

  if (loading) return <p>Loading student portal...</p>;

  if (error) {
    return (
      <main>
        <h2>Unable to load student details</h2>
        <p role="alert">{error}</p>
        <button onClick={logout}>Return to Login</button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto" }}>
      <h1>Student Portal</h1>
      <p>Welcome, {student?.full_name || "Student"}</p>

      <section>
        <h2>Application Progress</h2>
        <p>Current Stage: {student?.stage || "Not available"}</p>
      </section>

      <section>
        <h2>Qualification Details</h2>
        <p>Manage your qualification information here.</p>
      </section>

<ApplicationSection />

      <button onClick={logout}>Logout</button>
    </main>
  );
}
