import { z } from "zod";
import { GIFT_CARD_MAX, GIFT_CARD_MIN } from "./codes";

/** Shared by the purchase form (client validation) and the Server Action. */
export const giftCardPurchaseFormSchema = z.object({
  amount: z
    .number("Choose an amount")
    .int()
    .min(GIFT_CARD_MIN, "Gift cards start at EGP 250")
    .max(GIFT_CARD_MAX, "Gift cards go up to EGP 25,000"),
  recipientName: z.string().trim().min(1, "Enter the recipient's name").max(60),
  recipientEmail: z.email("Enter the recipient's email").max(254).toLowerCase(),
  senderName: z.string().trim().min(1, "Enter your name").max(60),
  purchaserEmail: z.email("Enter your email for the receipt").max(254).toLowerCase(),
  message: z.string().trim().max(300, "Keep your message under 300 characters").optional(),
  deliverOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a delivery date"),
});
