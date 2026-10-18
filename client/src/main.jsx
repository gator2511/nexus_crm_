
import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";

import Enquiry from "./pages/Enquiry.jsx";

function App() {
  return (
    <BrowserRouter>
      <header style={{ padding: 20, background: "#f3f4f6" }}>
        <h1>Nexus CRM</h1>
        <nav>
          {" | "}
<Link to="/login">Student Login</Link>
          <Link to="/enquiry">Student Enquiry</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/enquiry" replace />} />
        <Route path="/enquiry" element={<Enquiry />} />
        <Route path="*" element={<p>Page not found</p>} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import Login from "./pages/Login.jsx";
