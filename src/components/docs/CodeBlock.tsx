import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

const CodeBlock = ({ code, language = "text", filename }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] overflow-hidden my-4">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#161616] border-b border-[#2a2a2a]">
          <span className="text-xs text-[#888] font-mono">{filename}</span>
          <button
            onClick={handleCopy}
            className="text-[#666] hover:text-[#aaa] transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      )}
      {!filename && (
        <div className="flex justify-end px-4 py-1.5 bg-[#161616] border-b border-[#2a2a2a]">
          <button
            onClick={handleCopy}
            className="text-[#666] hover:text-[#aaa] transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="text-[#e4e4e7] font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
