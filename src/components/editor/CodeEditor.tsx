import { useState, useRef, useEffect, useCallback } from "react";
import { useProjectStore, type ProjectFile } from "@/stores/projectStore";
import { Textarea } from "@/components/ui/textarea";

const getLanguage = (ext?: string) => {
  switch (ext) {
    case "ts":
    case "tsx":
      return "TypeScript";
    case "js":
    case "jsx":
      return "JavaScript";
    case "json":
      return "JSON";
    case "html":
      return "HTML";
    case "css":
    case "scss":
      return "CSS";
    case "md":
      return "Markdown";
    case "xml":
    case "svg":
      return "XML";
    case "java":
      return "Java";
    case "kt":
      return "Kotlin";
    case "gradle":
      return "Gradle";
    case "yaml":
    case "yml":
      return "YAML";
    default:
      return "Plain Text";
  }
};

const CodeEditor = () => {
  const { openFile, updateFileContent } = useProjectStore();
  const [localContent, setLocalContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalContent(openFile?.content || "");
  }, [openFile?.path]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalContent(val);
      if (openFile) {
        updateFileContent(openFile.path, val);
      }
    },
    [openFile, updateFileContent]
  );

  if (!openFile) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Select a file to edit</p>
          <p className="text-xs text-muted-foreground/60">Upload a project or click on a file in the sidebar</p>
        </div>
      </div>
    );
  }

  if (openFile.content === "[Binary file]") {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Binary file — cannot preview</p>
          <p className="text-xs text-muted-foreground/60">{openFile.path}</p>
        </div>
      </div>
    );
  }

  const lines = localContent.split("\n");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* File tab */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
        <span className="text-xs font-mono text-foreground">{openFile.name}</span>
        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
          {getLanguage(openFile.extension)}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {lines.length} lines
        </span>
      </div>

      {/* Editor area with line numbers */}
      <div className="flex-1 overflow-auto relative">
        <div className="flex min-h-full">
          {/* Line numbers */}
          <div className="sticky left-0 bg-[hsl(220,13%,10%)] border-r border-border px-3 py-3 select-none z-10">
            {lines.map((_, i) => (
              <div
                key={i}
                className="text-[11px] font-mono text-muted-foreground/40 leading-[1.6] text-right"
                style={{ height: "1.6em" }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code content */}
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleChange}
            spellCheck={false}
            className="flex-1 bg-transparent text-[12px] font-mono leading-[1.6] text-foreground/90 p-3 resize-none outline-none border-none min-h-full"
            style={{
              tabSize: 2,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Cascadia Code', 'Consolas', monospace",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
