"use client";

import { useState } from "react";
import { Modal } from "@/components/feedback/Modal";
import { HOW_TO_MEASURE, type SizeGuide } from "@/config/size-guides";

/** Self-drawn measuring figure: chest, waist, hip and inseam guides. */
function MeasureFigure() {
  return (
    <svg
      viewBox="0 0 160 300"
      className="h-56 w-auto text-ink-soft"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <circle cx="80" cy="30" r="16" />
      <path d="M80 46v14M50 70q30-14 60 0l8 70-14 4-6-44v60l8 120h-22l-14-100-14 100H40l8-120V100l-6 44-14-4z" />
      <g strokeDasharray="4 4" className="text-accent" stroke="currentColor">
        <path d="M44 92h72" />
        <path d="M50 128h60" />
        <path d="M46 160h68" />
        <path d="M86 176v100" />
      </g>
    </svg>
  );
}

export function SizeGuideModal({ guide }: { guide: SizeGuide }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm underline underline-offset-4 hover:text-accent"
      >
        Size guide
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Size guide"
        description={guide.title}
        className="max-w-3xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">{guide.title}, measurements in inches</caption>
            <thead>
              <tr className="border-b border-line-strong text-left">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Size
                </th>
                {guide.columns.map((c) => (
                  <th key={c} scope="col" className="py-2 pr-4 font-medium">
                    {c} (in)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guide.rows.map((row) => (
                <tr key={row.size} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {row.size}
                  </th>
                  {row.values.map((value, i) => (
                    <td key={guide.columns[i] ?? i} className="py-2 pr-4 text-ink-soft">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 list-disc pl-5 text-sm text-ink-soft">
          {guide.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <h3 className="mt-8 text-label">How to measure</h3>
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <MeasureFigure />
          <dl className="grid gap-3 text-sm">
            {HOW_TO_MEASURE.map((m) => (
              <div key={m.label}>
                <dt className="font-medium">{m.label}</dt>
                <dd className="text-ink-soft">{m.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Modal>
    </>
  );
}
