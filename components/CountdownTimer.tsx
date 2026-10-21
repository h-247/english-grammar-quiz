"use client";

import { useEffect, useState, useRef } from "react";
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

export function CountdownTimer({
  deadlineAt,
  startedAt,
  serverNow,
  mode = "timed",
  onExpire,
  className,
}: CountdownTimerProps) {
  const { showToast } = useToast();

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
        showToast("One minute remaining! Please finalize your answers.", "warning", 5000);
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
  }, [deadlineAt, startedAt, mode, showToast]);

  // Practice mode display
  if (mode === "practice") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 font-mono text-sm font-semibold shadow-sm",
          className
        )}
        aria-label={`Practice session elapsed time: ${formatTime(elapsedSeconds)}`}
      >
        <BookOpen className="w-4 h-4 text-emerald-400" />
        <span>Practice • {formatTime(elapsedSeconds)}</span>
      </div>
    );
  }

  // Timed exam display
  const isLowTime = secondsLeft <= 60;
  const isCritical = secondsLeft <= 15;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono text-sm font-semibold transition-all shadow-sm",
        isCritical
          ? "bg-rose-950/60 border-rose-500/80 text-rose-300 animate-pulse"
          : isLowTime
          ? "bg-amber-950/50 border-amber-500/70 text-amber-300"
          : "bg-[#262626] border-[#383838] text-[#ECECEC]",
        className
      )}
      aria-label={`Time remaining: ${formatTime(secondsLeft)}`}
    >
      {isLowTime ? (
        <AlertTriangle className={cn("w-4 h-4", isCritical ? "text-rose-400" : "text-amber-400")} />
      ) : (
        <Clock className="w-4 h-4 text-[#9CA3AF]" />
      )}
      <span>{formatTime(secondsLeft)}</span>
    </div>
  );
}
