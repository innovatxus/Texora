"use client";

import { useId, useState, type FormEvent } from "react";
import { CheckIcon } from "@/components/icons";
import { Button, Input, Select, Textarea } from "@/components/primitives";
import { CONTACT_TOPICS } from "@/config/help";
import { submitContactRequest } from "@/lib/help/actions";

type Field = "name" | "email" | "topic" | "orderNumber" | "message";

export function ContactForm() {
  const id = useId();
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    email: "",
    topic: "",
    orderNumber: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field | "form", string>>>({});
  const [state, setState] = useState<"idle" | "pending" | { reference: string }>("idle");

  const set = (field: Field) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setState("pending");
    const { orderNumber, ...rest } = values;
    const result = await submitContactRequest({
      ...rest,
      ...(orderNumber.trim() ? { orderNumber } : {}),
    });
    if (result.ok) {
      setState({ reference: result.data.reference });
      return;
    }
    setState("idle");
    const fields = result.error.fieldErrors ?? {};
    setErrors({
      ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] ?? ""])),
      ...(result.error.code !== "validation" ? { form: result.error.message } : {}),
    });
  };

  if (typeof state === "object") {
    return (
      <div role="status" className="bg-surface p-6">
        <p className="flex items-center gap-2 font-medium">
          <CheckIcon /> Thanks, we&apos;ve got your message
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          We reply within one business day to {values.email}. Your reference is{" "}
          <strong className="text-ink">{state.reference}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Input
        id={`${id}-name`}
        label="Name"
        required
        autoComplete="name"
        value={values.name}
        onChange={(e) => set("name")(e.target.value)}
        error={errors.name}
      />
      <Input
        id={`${id}-email`}
        label="Email"
        type="email"
        required
        autoComplete="email"
        value={values.email}
        onChange={(e) => set("email")(e.target.value)}
        error={errors.email}
      />
      <Select
        id={`${id}-topic`}
        label="What's it about?"
        required
        placeholder="Choose a topic"
        options={CONTACT_TOPICS}
        value={values.topic}
        onChange={(e) => set("topic")(e.target.value)}
        error={errors.topic}
      />
      <Input
        id={`${id}-order`}
        label="Order number (optional)"
        placeholder="TX-100482"
        autoComplete="off"
        value={values.orderNumber}
        onChange={(e) => set("orderNumber")(e.target.value)}
        error={errors.orderNumber}
      />
      <Textarea
        id={`${id}-message`}
        label="Message"
        required
        maxLength={2000}
        showCount
        value={values.message}
        onChange={(e) => set("message")(e.target.value)}
        error={errors.message}
        className="sm:col-span-2"
      />
      {errors.form && (
        <p role="alert" className="text-sm text-sale sm:col-span-2">
          {errors.form}
        </p>
      )}
      <Button type="submit" size="lg" loading={state === "pending"} className="self-start">
        Send message
      </Button>
    </form>
  );
}
