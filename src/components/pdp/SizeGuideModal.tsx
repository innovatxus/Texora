"use client";

import { useState } from "react";
import { Modal } from "@/components/feedback/Modal";
import type { SizeGuide } from "@/config/size-guides";
import { HowToMeasure, SizeGuideTable } from "./SizeGuideContent";

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
        <SizeGuideTable guide={guide} />
        <HowToMeasure />
      </Modal>
    </>
  );
}
