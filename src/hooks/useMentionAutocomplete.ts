"use client";

import { useState, useCallback, useRef } from "react";
import type { Repository } from "@/lib/types";

const MAX_RESULTS = 8;

interface UseMentionAutocompleteOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  repos: Repository[];
}

interface MentionTrigger {
  start: number;
  query: string;
}

function findMentionTrigger(
  text: string,
  cursorPos: number,
): MentionTrigger | null {
  const before = text.slice(0, cursorPos);
  const atIdx = before.lastIndexOf("@");
  if (atIdx < 0) return null;
  if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) return null;
  const query = before.slice(atIdx + 1);
  if (/\s/.test(query)) return null;
  return { start: atIdx, query };
}

export function useMentionAutocomplete({
  textareaRef,
  value,
  onChange,
  repos,
}: UseMentionAutocompleteOptions) {
  const [mentionActive, setMentionActive] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const triggerRef = useRef<MentionTrigger | null>(null);

  const repoLabels = repos.map((r) => `${r.owner}/${r.name}`);

  const filtered = mentionActive
    ? repoLabels
        .filter((label) => label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, MAX_RESULTS)
    : [];

  const dismiss = useCallback(() => {
    setMentionActive(false);
    setQuery("");
    setHighlightIdx(0);
    triggerRef.current = null;
  }, []);

  const selectItem = useCallback(
    (index: number) => {
      const item = filtered[index];
      if (!item || !triggerRef.current) return;

      const { start } = triggerRef.current;
      const before = value.slice(0, start);
      const cursorPos = textareaRef.current?.selectionStart ?? value.length;
      const after = value.slice(cursorPos);
      const inserted = `@${item} `;
      const newValue = before + inserted + after;

      onChange(newValue);
      dismiss();

      const newCursorPos = before.length + inserted.length;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.selectionStart = newCursorPos;
          el.selectionEnd = newCursorPos;
          el.focus();
        }
      });
    },
    [filtered, value, onChange, dismiss, textareaRef],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      const cursorPos = e.target.selectionStart;
      const trigger = findMentionTrigger(newValue, cursorPos);

      if (trigger && repoLabels.length > 0) {
        triggerRef.current = trigger;
        setQuery(trigger.query);
        setHighlightIdx(0);
        setMentionActive(true);
      } else {
        dismiss();
      }
    },
    [onChange, repoLabels.length, dismiss],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!mentionActive || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx(
          (prev) => (prev - 1 + filtered.length) % filtered.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectItem(highlightIdx);
      } else if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    },
    [mentionActive, filtered.length, highlightIdx, selectItem, dismiss],
  );

  return {
    mentionActive: mentionActive && filtered.length > 0,
    query,
    filtered,
    highlightIdx,
    handleKeyDown,
    handleChange,
    selectItem,
    dismiss,
  };
}
