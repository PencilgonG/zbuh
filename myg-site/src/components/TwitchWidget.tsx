"use client";
import { useEffect, useRef } from "react";

export default function TwitchWidget({ channel }: { channel: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = "250";
    iframe.allowFullscreen = true;
    // IMPORTANT: en local, parent=localhost; en prod, ce sera ton domaine
    const parent = location.hostname;
    iframe.src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&muted=true`;
    iframe.frameBorder = "0";
    ref.current.appendChild(iframe);
  }, [channel]);

  return <div ref={ref} />;
}
