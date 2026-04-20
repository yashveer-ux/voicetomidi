# VOICEtoMIDI — Next Steps Before Going Live

## 🔴 Must Do Before Accepting Real Payments

- [ ] **Switch Stripe to live mode** — replace `STRIPE_SECRET_KEY` on Railway with `sk_live_...`
- [ ] **Complete Stripe business verification** — required to receive payouts (stripe.com/dashboard)
- [ ] **Add payout bank account** in Stripe dashboard

## 📄 Legal (Next Session)

- [ ] **Privacy Policy page** — what data is collected, how it's used, contact info
- [ ] **Terms of Service page** — refund policy (no refunds / contact support), acceptable use
- [ ] **Cookie notice** — if analytics are added later

## 🎨 UX Polish

- [ ] **Export loading spinner** — full-screen overlay while Stripe checkout is opening
- [ ] **Cold start error handling** — friendly message if Railway backend is slow to wake up
- [ ] **Success message** — confirm to user that download has started

## ⚙️ Reliability

- [ ] **Railway keep-alive** — upgrade to paid plan or add a ping to prevent cold starts
- [ ] **Test full export flow on mobile** — verify Stripe Checkout works on iPhone/Android

## 🌐 Nice to Have

- [ ] **Custom domain** — e.g. `voicetomidi.com` instead of `voicetomidi.vercel.app`
- [ ] **SEO meta tags** — title, description, og:image for link previews
- [ ] **PWA** — installable on phone home screen, offline support

## 🔮 Future Features

- [ ] **User accounts + Auth** — cloud project saving, purchase history
- [ ] **Audio file import** — import any audio sample → detect pitch → add to piano roll
  - Phase 1 (quick): file picker → existing `/analyze` endpoint → mono melody
  - Phase 2: Demucs stem separation → polyphonic multi-track output
