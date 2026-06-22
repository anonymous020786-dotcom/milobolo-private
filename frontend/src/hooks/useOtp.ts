import { useState } from "react";
import axios from "axios";

const SIGNAL_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || "";

export function useOtp() {
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const sendOtp = async (email: string, type: string) => {
    setSending(true); setError("");
    try {
      await axios.post(`${SIGNAL_URL}/api/send-otp`, { email, type });
      let secs = 60;
      setCountdown(secs);
      const timer = setInterval(() => {
        secs--;
        setCountdown(secs);
        if (secs <= 0) clearInterval(timer);
      }, 1000);
      return true;
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to send OTP");
      return false;
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async (email: string, otp: string, type: string) => {
    setVerifying(true); setError("");
    try {
      await axios.post(`${SIGNAL_URL}/api/verify-otp`, { email, otp, type });
      return true;
    } catch (e: any) {
      setError(e.response?.data?.error || "Invalid OTP");
      return false;
    } finally {
      setVerifying(false);
    }
  };

  return { sendOtp, verifyOtp, sending, verifying, error, setError, countdown };
}
