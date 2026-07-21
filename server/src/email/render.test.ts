import { describe, it, expect } from "vitest";
import { renderEmail, type RenderContext } from "./render";

const ctx: RenderContext = {
  businessName: "Prestige Motors",
  contactFirstName: "Jordan",
  contactLastName: "Reed",
  city: "Plano",
  senderName: "Andy",
  myBusiness: "Amei Auto Detailz",
  unsubscribeUrl: "https://app.example/unsubscribe?e=a@b.com",
  businessAddress: "Amei Auto Detailz, Garland, TX 75040",
};

describe("renderEmail", () => {
  it("substitutes bracket variables in subject and body", () => {
    const out = renderEmail("Hi [Business Name]", "Hello [Contact Name], — [My Name]", ctx);
    expect(out.subject).toBe("Hi Prestige Motors");
    expect(out.text).toContain("Hello Jordan Reed");
    expect(out.text).toContain("Andy");
  });

  it("falls back gracefully for missing values", () => {
    const out = renderEmail("[Business Name]", "Hi [First Name]", {
      ...ctx,
      businessName: null,
      contactFirstName: null,
    });
    expect(out.subject).toBe("there");
    expect(out.text).toContain("Hi there");
  });

  it("leaves unknown tokens untouched", () => {
    const out = renderEmail("x", "Value: [Unknown Token]", ctx);
    expect(out.text).toContain("[Unknown Token]");
  });

  it("HTML-escapes substituted values but keeps plain text raw", () => {
    const evil = { ...ctx, businessName: "Bob & <b>Co</b>" };
    const out = renderEmail("[Business Name]", "[Business Name]", evil);
    expect(out.html).toContain("Bob &amp; &lt;b&gt;Co&lt;/b&gt;");
    expect(out.html).not.toContain("<b>Co</b>");
    expect(out.text).toContain("Bob & <b>Co</b>");
  });

  it("appends the CAN-SPAM footer with address and unsubscribe link", () => {
    const out = renderEmail("s", "body", ctx);
    expect(out.text).toContain("Garland, TX 75040");
    expect(out.text).toContain("Unsubscribe:");
    expect(out.html).toContain(ctx.unsubscribeUrl);
  });
});
