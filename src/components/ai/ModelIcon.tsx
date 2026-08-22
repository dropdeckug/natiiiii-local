import geminiSvg from "@/assets/models/gemini.svg";
import openaiSvg from "@/assets/models/openai.svg";
import anthropicSvg from "@/assets/models/anthropic.svg";

interface ModelIconProps {
  modelId: string;
  size?: number;
  className?: string;
}

/**
 * Real provider SVG for an AI model ID like "anthropic/claude-fable-5",
 * "google/gemini-2.5-pro" or "openai/gpt-5-mini".
 */
const ModelIcon = ({ modelId, size = 14, className = "" }: ModelIconProps) => {
  const isOpenAI = modelId.startsWith("openai/") || modelId.startsWith("gpt-");
  const isAnthropic = modelId.startsWith("anthropic/") || modelId.startsWith("claude-");
  const src = isAnthropic ? anthropicSvg : isOpenAI ? openaiSvg : geminiSvg;
  const alt = isAnthropic ? "Anthropic Claude" : isOpenAI ? "OpenAI" : "Google Gemini";
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      className={`inline-block shrink-0 ${isOpenAI ? "dark:invert" : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  );
};


export default ModelIcon;
