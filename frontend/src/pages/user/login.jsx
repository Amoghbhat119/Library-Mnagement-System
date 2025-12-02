import React, { useState } from "react";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./login.css";
import { Server_URL } from "../../utils/config";
import { showErrorToast, showSuccessToast } from "../../utils/toasthelper";

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // login for ANY role
      const res = await axios.post(`${Server_URL}users/login`, {
        email: data.email,
        password: data.password,
      });

      // ✅ correct places to read from
      const token = res?.data?.token;
      const role = res?.data?.user?.role;

      if (!token || !role) {
        throw new Error("Invalid login response from server");
      }

      localStorage.setItem("authToken", token);
      localStorage.setItem("role", role);

      showSuccessToast("Login Successful!");

      // route by role
      if (role === "admin" || role === "librarian") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Error:", error?.response?.data || error?.message);
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Login Failed! Check credentials.";
      showErrorToast(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">User Login</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="login-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              {...register("email", { required: "Email is required" })}
              className="form-input"
              autoComplete="username"
            />
            {errors.email && (
              <span className="error-text">{errors.email.message}</span>
            )}
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              {...register("password", { required: "Password is required" })}
              className="form-input"
              autoComplete="current-password"
            />
            {errors.password && (
              <span className="error-text">{errors.password.message}</span>
            )}
          </div>

          <div className="forgot-password">
            <button
              type="button"
              className="forgot-btn"
              onClick={() => navigate("/forgetpassword")}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
