/** Four L-shaped corner brackets — Andromeda cards use these instead of full borders. */
export function CornerMarkers({
  size = 12,
  offset = 0,
  borderWidth = 1,
  color = "#5B5B5C",
}: {
  size?: number;
  offset?: number;
  borderWidth?: number;
  color?: string;
}) {
  const positions = [
    { key: "tl", top: offset, left: offset },
    { key: "tr", top: offset, right: offset },
    { key: "bl", bottom: offset, left: offset },
    { key: "br", bottom: offset, right: offset },
  ] as const;

  return (
    <>
      {positions.map(({ key, ...coords }) => (
        <span
          key={key}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: size,
            height: size,
            borderStyle: "solid",
            borderColor: color,
            borderTopWidth: key.startsWith("t") ? borderWidth : 0,
            borderBottomWidth: key.startsWith("b") ? borderWidth : 0,
            borderLeftWidth: key.endsWith("l") ? borderWidth : 0,
            borderRightWidth: key.endsWith("r") ? borderWidth : 0,
            ...coords,
          }}
        />
      ))}
    </>
  );
}
