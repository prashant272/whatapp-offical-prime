import React, { useRef, useEffect } from "react";
import { Bold, Italic, Link, Palette } from "lucide-react";

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);

  // Sync internal HTML content with the value prop if it changes externally
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command, val = null) => {
    document.execCommand(command, false, val);
    handleInput();
    // Keep focus in the editor after applying formatting
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleLink = () => {
    const url = prompt("Enter link URL (e.g. https://google.com):");
    if (url !== null) {
      // If empty link, remove link
      if (url === "") {
        executeCommand("unlink");
      } else {
        executeCommand("createLink", url);
      }
    }
  };

  return (
    <div style={{
      border: "1px solid #cbd5e1",
      borderRadius: "10px",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      background: "white",
      transition: "border-color 0.2s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
    }}>
      {/* Formatting Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 12px",
        background: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
        flexWrap: "wrap"
      }}>
        <button
          type="button"
          onClick={() => executeCommand("bold")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            background: "white",
            cursor: "pointer",
            color: "#334155",
            transition: "all 0.15s"
          }}
          title="Bold"
          onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
          onMouseLeave={(e) => e.currentTarget.style.background = "white"}
        >
          <Bold size={15} />
        </button>

        <button
          type="button"
          onClick={() => executeCommand("italic")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            background: "white",
            cursor: "pointer",
            color: "#334155",
            transition: "all 0.15s"
          }}
          title="Italic"
          onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
          onMouseLeave={(e) => e.currentTarget.style.background = "white"}
        >
          <Italic size={15} />
        </button>

        <button
          type="button"
          onClick={handleLink}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            background: "white",
            cursor: "pointer",
            color: "#334155",
            transition: "all 0.15s"
          }}
          title="Insert Link"
          onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
          onMouseLeave={(e) => e.currentTarget.style.background = "white"}
        >
          <Link size={15} />
        </button>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          padding: "0 8px",
          height: "32px",
          background: "white"
        }}>
          <Palette size={14} color="#64748b" />
          <input
            type="color"
            onChange={(e) => executeCommand("foreColor", e.target.value)}
            style={{
              width: "20px",
              height: "20px",
              padding: 0,
              border: "none",
              cursor: "pointer",
              background: "none"
            }}
            title="Text Color"
          />
        </div>
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        style={{
          minHeight: "220px",
          maxHeight: "450px",
          padding: "16px",
          overflowY: "auto",
          outline: "none",
          background: "white",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          lineHeight: "1.5",
          color: "#1e293b"
        }}
        placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
