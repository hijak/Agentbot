export async function prepareHostedImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.78),
    );
    if (!blob || blob.size >= file.size) return file;
    const stem = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${stem}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // createImageBitmap/canvas can be unavailable in some embedded contexts.
    return file;
  }
}

export async function canvasToHostedJpeg(
  source: HTMLCanvasElement,
  filename: string,
): Promise<File | null> {
  if (source.width < 1 || source.height < 1) return null;
  const maxWidth = 1440;
  const scale = Math.min(1, maxWidth / source.width);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(source.width * scale));
  output.height = Math.max(1, Math.round(source.height * scale));
  const context = output.getContext("2d");
  if (!context) return null;

  try {
    context.drawImage(source, 0, 0, output.width, output.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, "image/jpeg", 0.76),
    );
    return blob
      ? new File([blob], filename, { type: "image/jpeg", lastModified: Date.now() })
      : null;
  } catch {
    return null;
  }
}
