/**
 * Every user-facing string lives here.
 * To add a language: copy `en`, translate it, add it to `messages`,
 * and choose which one `m` points to.
 */
const en = {
  brand: "GiftLink",

  meta: {
    title: "GiftLink: send a moment",
    description: "Wrap any link as a gift. They unwrap it before they see it.",
    giftTitle: (sender: string) => `${sender} sent you a gift`,
    giftFallbackTitle: "A gift is waiting for you",
    giftDescription: "Tap to unwrap it.",
    giftImageAlt: "A wrapped gift",
    createTitle: "Create a gift",
    manageTitle: "Your gift",
  },

  landing: {
    pitch: "Don't just send a link. Send a moment.",
    sub: "Wrap any link as a gift. They unwrap it, then land on the real thing.",
    cta: "Create a gift",
  },

  create: {
    heading: "Create a gift",
    intro: "Paste a link, add a few words, and choose how it is wrapped.",
    url: "Link to wrap",
    urlPlaceholder: "https://",
    urlHint: "Must start with https://",
    receiverName: "Who is it for?",
    senderName: "Your name",
    note: "Short note",
    noteHint: "Shown after they unwrap it.",
    wrapStyle: "Wrap style",
    wrapBox: "Gift box",
    wrapBoxHint: "Midnight, confetti",
    wrapEnvelope: "Envelope",
    wrapEnvelopeHint: "Light, clean",
    optional: "optional",
    unlockAt: "Unlock date and time",
    unlockHint: "In your time zone. They see it in theirs.",
    secretQuestion: "Secret question",
    secretQuestionPlaceholder: "Where did we first meet?",
    secretAnswer: "Answer",
    secretHint: "They must answer before unwrapping. Capital letters don't matter.",
    submit: "Wrap it",
    submitting: "Wrapping…",
  },

  created: {
    heading: "Your gift is wrapped",
    shareLabel: "Share link",
    shareHint: "Send this to the receiver.",
    manageLabel: "Private manage link",
    manageHint: "Keep this one. It shows whether your gift was opened, and it can't be recovered.",
    another: "Wrap another",
  },

  copy: {
    copy: "Copy",
    copied: "Copied",
  },

  gift: {
    notFoundHeading: "This gift doesn't exist",
    notFoundBody: "The link may be incomplete. Ask the sender to share it again.",
    lockedHeading: (sender: string) => `${sender} sent you a gift`,
    lockedBody: "It isn't ready to open yet.",
    opensAt: (when: string) => `Opens ${when}`,
    days: "days",
    hours: "hours",
    minutes: "min",
    seconds: "sec",
    questionHeading: (sender: string) => `First, a question from ${sender}`,
    answerLabel: "Your answer",
    answerSubmit: "Unlock",
    answerChecking: "Checking…",
    answerWrong: "That's not it. Try again.",
    wrappedHeading: (receiver: string) => `${receiver}, this is for you`,
    wrappedFrom: (sender: string) => `From ${sender}`,
    tapBox: "Tap the gift to unwrap",
    tapSeal: "Tap the seal to open",
    boxLabel: "Unwrap your gift",
    sealLabel: "Break the seal",
    cardFor: (receiver: string) => `For ${receiver}`,
    revealHeading: (sender: string) => `A gift from ${sender}`,
    noteFrom: (sender: string) => `${sender}`,
    open: "Open your gift",
    makeOne: "Make one for someone",
    wrappedWith: "Wrapped with GiftLink",
    error: "Something went wrong. Check your connection and try again.",
  },

  manage: {
    heading: (receiver: string) => `Your gift for ${receiver}`,
    invalidHeading: "This manage link isn't valid",
    invalidBody: "Check that you copied the whole link, including the key.",
    opened: "Opened",
    notOpened: "Not opened yet",
    openedAt: "Opened on",
    createdAt: "Created on",
    unlocksAt: "Unlocks on",
    refreshHint: "Reload this page to check again.",
    shareLabel: "Share link",
    shareHint: "Send this to the receiver.",
  },

  errors: {
    required: "This is required.",
    urlInvalid: "Enter a full link that starts with https://",
    tooLong: "This is too long.",
    dateInvalid: "Enter a valid date and time.",
    secretPair: "Add both a question and an answer, or leave both empty.",
    wrapInvalid: "Choose a wrap style.",
    generic: "Something went wrong. Please try again.",
  },
};

export type Messages = typeof en;
export type ErrorKey = keyof Messages["errors"];

export const messages = { en };

export const m: Messages = messages.en;
