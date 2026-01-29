import { useEffect, useRef, useState } from "react";
import {
  X,
  CheckCircle,
  XCircle,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import type { ActionReceipt } from "../types";
import { cn, formatRelativeTime, formatDuration } from "../utils";

interface Props {
  receipt: ActionReceipt | null;
  onClose: () => void;
}

const tierBadge: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  high: "bg-red-500/10 text-red-400",
};

function CopyableHash({ label, hash }: { label: string; hash: string }) {
  const [copied, setCopied] = useState(false);
  const ariaLabel = `Copy ${label.toLowerCase().includes("arguments") ? "arguments" : "result"} hash`;

  function handleCopy() {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mb-3">
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      <div className="flex items-start gap-2">
        <span className="font-mono text-xs break-all text-neutral-300 flex-1">
          {hash}
        </span>
        <button
          onClick={handleCopy}
          aria-label={ariaLabel}
          className="shrink-0 p-1 rounded hover:bg-neutral-700 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="sr-only">Copied</span>
            </>
          ) : (
            <Copy className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

function Accordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const sanitizedLabel = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="border-t border-neutral-800">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`accordion-${sanitizedLabel}`}
        className="flex items-center justify-between w-full py-3 text-sm text-neutral-300 hover:text-white transition-colors"
      >
        {title}
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && <div id={`accordion-${sanitizedLabel}`} className="pb-3">{children}</div>}
    </div>
  );
}

export default function ReceiptDetail({ receipt, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (receipt) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [receipt, onClose]);

  useEffect(() => {
    if (receipt) {
      closeButtonRef.current?.focus();
    }
  }, [receipt]);

  if (!receipt) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-detail-title"
        className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-neutral-900 border-l border-neutral-800 z-50 overflow-y-auto"
      >
        <div key={receipt.id} className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 id="receipt-detail-title" className="text-lg font-bold truncate pr-4">{receipt.toolName}</h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close detail panel"
              className="p-1 rounded hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                tierBadge[receipt.tier],
              )}
            >
              {receipt.tier}
            </span>
            {receipt.success ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Success
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Failure
              </span>
            )}
          </div>

          <div className="space-y-3 mb-5">
            <div>
              <div className="text-xs text-neutral-400">Time</div>
              <div className="text-sm">{formatRelativeTime(receipt.timestamp)}</div>
              <div className="text-xs text-neutral-400">{receipt.timestamp}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400">Duration</div>
              <div className="text-sm">{formatDuration(receipt.durationMs)}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400">Session</div>
              <div className="font-mono text-xs text-neutral-300">{receipt.sessionKey}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400">Anomalies</div>
              {receipt.anomalies.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {receipt.anomalies.map((a, i) => (
                    <span
                      key={i}
                      className="bg-red-500/10 text-red-400 rounded-full px-2 py-0.5 text-xs"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-emerald-400">Clean</div>
              )}
            </div>
          </div>

          <Accordion title="Hashes">
            <CopyableHash label="Arguments Hash" hash={receipt.argumentsHash} />
            <CopyableHash label="Result Hash" hash={receipt.resultHash} />
          </Accordion>

          <Accordion title="EigenDA Verification">
            {receipt.daCommitment ? (
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs break-all text-neutral-300 flex-1">
                  {receipt.daCommitment}
                </span>
                <a
                  href="#"
                  aria-label="View on EigenDA explorer"
                  className="shrink-0 p-1 rounded hover:bg-neutral-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
                </a>
              </div>
            ) : (
              <div className="text-neutral-400 text-sm">
                Unverified — no DA commitment
              </div>
            )}
          </Accordion>

          <Accordion title="TEE Attestation">
            <div className="text-neutral-400 text-sm italic">
              TEE attestation verification coming soon
            </div>
          </Accordion>
        </div>
      </div>
    </>
  );
}
