"use client";

import { useEffect, useState, useRef, memo } from "react";
import { Clock, AlertTriangle, BookOpen } from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface CountdownTimerProps {
  deadlineAt: string; // ISO string from server
  startedAt?: string; // ISO string from server
  serverNow?: string; // ISO string from server
  mode?: "timed" | "practice";
  onExpire: () => void;
  className?: string;
}

export const CountdownTimer = memo(function CountdownTimer({
  deadlineAt,
  startedAt,
  serverNow,
  mode = "timed",
  onExpire,
  className,
}: CountdownTimerProps) {
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // For timed exam mode: countdown
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const deadlineMs = new Date(deadlineAt).getTime();
    const serverMs = serverNow ? new Date(serverNow).getTime() : 0;
    return serverMs > 0 ? Math.max(0, Math.floor((deadlineMs - serverMs) / 1000)) : 900;
  });

  // For practice mode: elapsed stopwatch
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const warnedRef = useRef<boolean>(false);
  const expiredRef = useRef<boolean>(false);
  const onExpireRef = useRef(onExpire);
  const clockSkewRef = useRef<number>(0);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (serverNow) {
      clockSkewRef.current = new Date(serverNow).getTime() - Date.now();
    }
  }, [serverNow]);

  useEffect(() => {
    if (mode === "practice") {
      const startMs = startedAt ? new Date(startedAt).getTime() : Date.now();
      const updateElapsed = () => {
        const nowMs = Date.now() + clockSkewRef.current;
        const diff = Math.max(0, Math.floor((nowMs - startMs) / 1000));
        setElapsedSeconds(diff);
      };

      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }

    const deadlineMs = new Date(deadlineAt).getTime();

    const updateTimer = () => {
      const estimatedServerNow = Date.now() + clockSkewRef.current;
      const diffMs = deadlineMs - estimatedServerNow;
      const left = Math.max(0, Math.floor(diffMs / 1000));

      setSecondsLeft(left);

      // 60-second warning notification
      if (left <= 60 && left > 0 && !warnedRef.current) {
        warnedRef.current = true;
        showToastRef.current("One minute remaining! Please finalize your answers.", "warning", 5000);
      }

      // Expiration trigger
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deadlineAt, startedAt, mode]);

  // Practice mode display
  if (mode === "practice") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 font-mono text-sm font-semibold shadow-sm",
          className
        )}
        title="Self-paced practice mode (Stopwatch)"
      >
        <BookOpen className="w-4 h-4 text-emerald-400" />
        <span className="text-xs uppercase tracking-wider font-sans text-emerald-400 font-bold hidden sm:inline">
          Practice
        </span>
        <span aria-live="off">{formatTime(elapsedSeconds)}</span>
      </div>
    );
  }

  // Timed exam mode display
  const isUrgent = secondsLeft <= 60;
  const isWarning = secondsLeft <= 180 && !isUrgent;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono text-sm font-semibold shadow-sm transition-colors",
        isUrgent
          ? "border-rose-500 bg-rose-950/50 text-rose-200 animate-pulse"
          : isWarning
          ? "border-amber-500/60 bg-amber-950/40 text-amber-200"
          : "border-[#383838] bg-[#1A1A1A] text-[#ECECEC]",
        className
      )}
      title="Remaining time before auto-submission"
    >
      {isUrgent ? (
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
      ) : (
        <Clock className="w-4 h-4 text-[#9CA3AF] shrink-0" />
      )}
      <span aria-live="polite">{formatTime(secondsLeft)}</span>
    </div>
  );
});
