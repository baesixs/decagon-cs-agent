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
        model?: string;
        error?: string;
      };
      if (!session.clientSecret) {
        throw new Error(session.error ?? "No Realtime client secret");
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

      const model = session.model ?? "gpt-4o-realtime-preview";
      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${session.clientSecret}`,
            "Content-Type": "application/sdp",
            "OpenAI-Beta": "realtime=v1",
          },
        },
      );
      if (!sdpRes.ok) {
        throw new Error(`Realtime SDP exchange failed (${sdpRes.status})`);
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

  return (
    <div className="sans flex flex-wrap items-center gap-2">
      <audio ref={audioRef} className="hidden" />
      {status === "idle" || status === "error" ? (
        <button
          type="button"
          onClick={() => void connect()}
          className="rounded-full border border-[var(--ink)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--ink)] hover:text-[var(--paper)]"
        >
          Connect voice
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-full border border-[var(--ink)] px-3 py-1.5 text-xs font-medium"
          >
            {status === "muted" ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={disconnect}
            className="rounded-full border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]"
          >
            Disconnect
          </button>
        </>
      )}
      <span className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
        {status === "connecting"
          ? "Connecting…"
          : status === "live"
            ? "Voice live"
            : status === "muted"
              ? "Muted"
              : status === "error"
                ? "Voice error"
                : "Text or voice"}
      </span>
      {error ? (
        <span className="text-[11px] text-[var(--accent)]">{error}</span>
      ) : null}
    </div>
  );
}
