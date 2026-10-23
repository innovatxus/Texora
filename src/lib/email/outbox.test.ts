import { extractLinks } from "./outbox-links";

describe("outbox links", () => {
  it("lists each http(s) link once with its text, decoding entities", () => {
    const html =
      '<p>Hi</p><a href="https://texora.app/verify?token=a&amp;next=%2F" style="x"><span>Verify your email</span></a>' +
      '<a href="https://texora.app/verify?token=a&amp;next=%2F">again</a>' +
      '<a href="mailto:care@texora.example">Email us</a><a href="javascript:alert(1)">x</a>';
    expect(extractLinks(html)).toEqual([
      { label: "Verify your email", href: "https://texora.app/verify?token=a&next=%2F" },
    ]);
  });

  it("falls back to the address when a link has no text", () => {
    expect(extractLinks('<a href="https://texora.app/r"></a>')).toEqual([
      { label: "https://texora.app/r", href: "https://texora.app/r" },
    ]);
  });
});
