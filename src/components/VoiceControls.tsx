"use client";

import { useCallback, useRef, useState } from "react";
import type { TraceEvent } from "@/lib/agent/trace";

type VoiceStatus = "idle" | "connecting" | "live" | "muted" | "error";

type Props = {
  onUserTranscript: (text: string) => void;
  onAssistantTranscript: (text: string) => void;
  onTraces: (events: TraceEvent[]) => void;
};

export function VoiceControls({
  onUserTranscript,
  onAssistantTranscript,
  onTraces,
}: Props) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assistantBuf = useRef("");

  const disconnect = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;
    setStatus("idle");
  }, []);

  const sendEvent = (payload: unknown) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(payload));
    }
  };

  const handleServerEvent = useCallback(
    async (raw: string) => {
      let event: {
        type?: string;
        name?: string;
        arguments?: string;
        call_id?: string;
        transcript?: string;
        delta?: string;
      };
      try {
        event = JSON.parse(raw) as typeof event;
      } catch {
        return;
      }

      if (event.type === "conversation.item.input_audio_transcription.completed") {
        if (event.transcript) onUserTranscript(event.transcript);
        return;
      }

      if (event.type === "response.audio_transcript.delta" && event.delta) {
        assistantBuf.current += event.delta;
        return;
      }

      if (event.type === "response.audio_transcript.done") {
        const text = event.transcript || assistantBuf.current;
        assistantBuf.current = "";
        if (text.trim()) onAssistantTranscript(text.trim());
        return;
      }

      if (event.type === "response.function_call_arguments.done") {
        if (!event.name || !event.call_id) return;
        const res = await fetch("/api/tools/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: event.name,
            arguments: event.arguments ?? "{}",
          }),
        });
        const result = (await res.json()) as {
          output: unknown;
          traces: TraceEvent[];
        };
        if (result.traces) onTraces(result.traces);
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify(result.output ?? result),
          },
        });
        sendEvent({ type: "response.create" });
      }
    },
    [onAssistantTranscript, onTraces, onUserTranscript],
  );

  const connect = async () => {
    setError(null);
    setStatus("connecting");
    try {
      const sessionRes = await fetch("/api/realtime/session", { method: "POST" });
      const session = (await sessionRes.json()) as {
        clientSecret?: string;
        error?: string;
      };
      if (!session.clientSecret) {
        throw new Error(session.error ?? "Voice is unavailable right now");
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = audioRef.current ?? document.createElement("audio");
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
      };

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = ms;
      pc.addTrack(ms.getTracks()[0]);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("message", (e) => {
        void handleServerEvent(String(e.data));
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${session.clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpRes.ok) {
        throw new Error(`Voice connection failed (${sdpRes.status})`);
      }
      const answer = { type: "answer" as const, sdp: await sdpRes.text() };
      await pc.setRemoteDescription(answer);
      setStatus("live");
    } catch (err) {
      disconnect();
      setStatus("error");
      setError(err instanceof Error ? err.message : "Voice failed");
    }
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setStatus(track.enabled ? "live" : "muted");
  };

  const onMicClick = () => {
    if (status === "idle" || status === "error") {
      void connect();
      return;
    }
    if (status === "connecting") return;
    toggleMute();
  };

  const live = status === "live" || status === "muted";

  return (
    <div className="flex items-center gap-1">
      <audio ref={audioRef} className="hidden" />
      <button
        type="button"
        onClick={onMicClick}
        disabled={status === "connecting"}
        title={
          status === "live"
            ? "Mute"
            : status === "muted"
              ? "Unmute"
              : "Talk"
        }
        aria-label={
          status === "live"
            ? "Mute microphone"
            : status === "muted"
              ? "Unmute microphone"
              : "Start voice"
        }
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
          live
            ? "bg-[var(--live)] text-white"
            : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        } ${status === "muted" ? "opacity-50" : ""}`}
      >
        {status === "connecting" ? (
          <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-current" />
        ) : (
          <MicIcon muted={status === "muted"} />
        )}
      </button>
      {live ? (
        <button
          type="button"
          onClick={disconnect}
          title="End voice"
          aria-label="End voice"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        >
          <HangupIcon />
        </button>
      ) : null}
      {error && status === "error" ? (
        <span className="max-w-[9rem] truncate text-[11px] text-[var(--live)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7 11a5 5 0 0 0 10 0M12 16v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {muted ? (
        <path
          d="M4 5l16 14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function HangupIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8c4-3 8-3 12 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 10.5L6.5 14M16 10.5L17.5 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
