import type { UIMessage } from "../session";
import { THEME } from "../theme";

interface Props {
  message: UIMessage;
  index: number;
}

interface TextSegment {
  text: string;
  color: string;
}

// Patterns to highlight
const PATTERNS = {
  // Inline code: `code`
  code: /`([^`]+)`/g,
  // File paths: /path/to/file or ./path/to/file
  path: /(?:^|\s)((?:\.{0,2}\/)?(?:[\w.-]+\/)+[\w.-]+)/g,
};

const parseHighlights = (text: string, baseColor: string): TextSegment[] => {
  const segments: TextSegment[] = [];

  // First pass: extract inline code
  const codeMatches: { start: number; end: number; text: string }[] = [];
  let match;

  PATTERNS.code.lastIndex = 0;
  while ((match = PATTERNS.code.exec(text)) !== null) {
    codeMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[1] ?? "",
    });
  }

  // Build segments
  let currentIndex = 0;
  for (const codeMatch of codeMatches) {
    // Add text before this match
    if (codeMatch.start > currentIndex) {
      const beforeText = text.slice(currentIndex, codeMatch.start);
      // Check for file paths in the before text
      segments.push(...parseFilePaths(beforeText, baseColor));
    }

    // Add the code match
    segments.push({
      text: codeMatch.text,
      color: THEME.colors.highlight.code,
    });

    currentIndex = codeMatch.end;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    const remainingText = text.slice(currentIndex);
    segments.push(...parseFilePaths(remainingText, baseColor));
  }

  // If no segments were added, return the original text
  if (segments.length === 0) {
    return [{ text, color: baseColor }];
  }

  return segments;
};

const parseFilePaths = (text: string, baseColor: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  PATTERNS.path.lastIndex = 0;
  let match;
  while ((match = PATTERNS.path.exec(text)) !== null) {
    const fullMatch = match[0];
    const path = match[1] ?? "";
    const matchStart = match.index + (fullMatch.length - path.length);

    // Add text before this match
    if (matchStart > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, matchStart),
        color: baseColor,
      });
    }

    // Add the path match
    segments.push({
      text: path,
      color: THEME.colors.highlight.path,
    });

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      color: baseColor,
    });
  }

  if (segments.length === 0) {
    return [{ text, color: baseColor }];
  }

  return segments;
};

const Message = ({ message, index }: Props) => {
  const isUser = message.role === "user";
  const baseColor = isUser
    ? THEME.colors.text.primary
    : THEME.colors.text.secondary;

  // Split by lines first, then highlight each line
  const lines = message.text.split("\n");

  return (
    <box
      key={index}
      border={["left"]}
      borderColor={
        isUser ? THEME.colors.border.focus : THEME.colors.border.default
      }
      style={{
        width: "100%",
        marginBottom: 1,
        paddingLeft: 1,
      }}
    >
      {lines.map((line, lineIndex) => {
        const segments = parseHighlights(line, baseColor);
        return (
          <box
            key={lineIndex}
            style={{ flexDirection: "row", flexWrap: "wrap" }}
          >
            {segments.map((segment, i) => (
              <text key={i} fg={segment.color}>
                {segment.text}
              </text>
            ))}
          </box>
        );
      })}
    </box>
  );
};

export default Message;
