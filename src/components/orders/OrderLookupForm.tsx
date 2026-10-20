"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/primitives";
import { lookupOrder } from "@/lib/orders/lookup-actions";

/** Order number + email → the order's tracking page. */
export function OrderLookupForm() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ orderNumber?: string; email?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    const result = await lookupOrder({ orderNumber, email });
    if (result.ok) {
      router.push(result.data.href);
      return;
    }
    setPending(false);
    const fields = result.error.fieldErrors ?? {};
    setErrors({
      ...(fields.orderNumber?.[0] ? { orderNumber: fields.orderNumber[0] } : {}),
      ...(fields.email?.[0] ? { email: fields.email[0] } : {}),
      ...(result.error.code !== "validation" ? { form: result.error.message } : {}),
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input
        id="lookup-order-number"
        label="Order number"
        required
        autoComplete="off"
        placeholder="TX-100482"
        hint="You'll find it in your confirmation email."
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
        error={errors.orderNumber}
      />
      <Input
        id="lookup-email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        hint="The email you used at checkout."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      {errors.form && (
        <p role="alert" className="text-sm text-sale">
          {errors.form}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="self-start">
        Find my order
      </Button>
    </form>
  );
}
