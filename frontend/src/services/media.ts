import type { Attachment } from "./conversation";

function toJpegDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxSide: number,
  quality = 0.82
): string {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}

function toBase64(dataUrl: string): string {
  return dataUrl.split(",")[1] ?? "";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't open this image."));
    img.src = url;
  });
}

export async function imageToAttachment(file: File): Promise<Attachment> {
  const url = URL.createObjectURL(file);

  try {
    const img = await loadImage(url);

    const dataUrl = toJpegDataUrl(
      img,
      img.naturalWidth,
      img.naturalHeight,
      1024
    );

    return {
      kind: "image",
      name: file.name,
      text: "",
      images: [toBase64(dataUrl)],
      preview: dataUrl,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("Couldn't read this video."));
    video.currentTime = time;
  });
}

export async function videoToAttachment(
  file: File,
  frameCount = 4
): Promise<Attachment> {
  if (file.size > 500 * 1024 * 1024) {
    throw new Error("Video is too large (max 500 MB).");
  }

  const url = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error("Couldn't open this video (format not supported)."));
    });

    const duration = video.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Couldn't read the video length.");
    }

    const frames: string[] = [];
    let preview = "";

    for (let i = 0; i < frameCount; i++) {
      await seekTo(video, (duration * (i + 0.5)) / frameCount);

      const dataUrl = toJpegDataUrl(
        video,
        video.videoWidth,
        video.videoHeight,
        768
      );

      if (i === 0) preview = dataUrl;
      frames.push(toBase64(dataUrl));
    }

    return {
      kind: "video",
      name: file.name,
      text: "",
      images: frames,
      preview,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}