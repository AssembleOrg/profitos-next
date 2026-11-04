"use client";

import { useState } from "react";
import Image from "next/image";
import { IconPlay } from "./icons";
import { track } from "./tracker";

/** YouTube carga recién al pedirlo: no pesa en la ficha ni tapa la página al entrar. */
export function VideoPlayer({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <div className="jw-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button type="button" className="jw-video" onClick={() => { setPlaying(true); track("video_play"); }} aria-label={`Reproducir ${title}`}>
      <Image src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" fill sizes="(max-width: 900px) 100vw, 60vw" unoptimized />
      <span className="jw-video-play"><IconPlay /></span>
    </button>
  );
}
