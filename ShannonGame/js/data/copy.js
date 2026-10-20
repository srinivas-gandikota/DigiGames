/* Kid-facing text (copy deck). Edit wording here only; no game rules live in this file. */
window.SG = window.SG || {};
SG.data = SG.data || {};
SG.data.CONTENT_VERSION = 1;

/* Common English words (3-7 letters). A freshly drawn Gibberish word of 3+ letters that is in this list makes the
   generator redraw the puzzle (GP-111). Uppercase only. */
SG.data.commonWords = [
  "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER", "WAS", "ONE", "OUR", "OUT", "DAY",
  "GET", "HAS", "HIM", "HIS", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "TWO", "WAY", "WHO", "BOY", "DID",
  "ITS", "LET", "PUT", "SAY", "SHE", "TOO", "USE", "CAT", "DOG", "SUN", "RUN", "EAT", "BIG", "RED", "TOP",
  "BED", "CUP", "HAT", "PEN", "BOX", "CAR", "BUS", "FUN", "MAP", "SKY", "TRY", "WHY", "YES", "AIR", "ASK",
  "FAR", "FEW", "GOT", "HOT", "JOB", "KEY", "LOT", "MAY", "OFF", "OWN", "SAW", "SIT", "TEN", "WIN", "ZOO",
  "ABOUT", "AFTER", "AGAIN", "BEING", "COULD", "EVERY", "FIRST", "FOUND", "GREAT", "HOUSE", "LARGE", "LEARN",
  "NEVER", "OTHER", "PLACE", "PLANT", "POINT", "RIGHT", "SMALL", "SOUND", "SPELL", "STILL", "STUDY", "THEIR",
  "THERE", "THESE", "THING", "THINK", "THREE", "WATER", "WHERE", "WHICH", "WORLD", "WOULD", "WRITE", "SCHOOL",
  "FRIEND", "MOTHER", "FATHER", "SISTER", "FAMILY", "PEOPLE", "LITTLE", "ANIMAL", "ANSWER", "BEFORE", "BETWEEN",
  "BOOKS", "CLASS", "CLOUD", "DANCE", "EARTH", "FIELD", "FRUIT", "GAMES", "HAPPY", "LIGHT", "MONEY", "MUSIC",
  "NIGHT", "PAPER", "RIVER", "ROUND", "STORY", "TABLE", "TODAY", "TREES", "WHITE", "YOUNG", "GARDEN", "SUMMER",
  "WINTER", "MORNING", "COLOUR", "FLOWER", "PLAYED", "READER"
];

SG.copy = {

  /* ================================================================ app */
  app: {
    title: "The Shannon Game",
    tagline: "Guess the hidden sentence, one letter at a time.",
    loading: "Robo is reading some stories. One moment!",
    noScript: "This game needs JavaScript to play. Please turn it on.",
    browserOld: "Please update your web browser to play this game."
  },

  /* ================================================================ ui (shared button words) */
  ui: {
    home: "Home",
    back: "Back",
    next: "Next",
    skip: "Skip",
    close: "Close",
    ok: "OK",
    yes: "Yes",
    no: "No",
    on: "On",
    off: "Off",
    more: "Show more",
    less: "Show less",
    start: "Start",
    robo: "Robo",
    you: "You"
  },

  /* ================================================================ home */
  home: {
    heading: "What shall we play?",
    greeting: [
      "Hi! I'm Robo. Want to guess some letters with me?",
      "Hello again! Pick a game and let's go.",
      "Hi there! Which game shall we try?",
      "Robo here! Ready for a guessing game?",
      "Welcome! I love guessing games. Do you?",
      "Hello! Let's find some hidden sentences."
    ],
    greetingNamed: [
      "Hi {nickname}! Ready to guess some letters?",
      "Welcome back, {nickname}! Pick a game.",
      "Hello {nickname}! Let's play.",
      "Robo here! Hi {nickname}!"
    ],
    markers: {
      startHere: "Start here",
      tryNext: "Try next"
    },
    tiles: {
      detective: { name: "Bit Detective", desc: "Find a secret letter using yes-or-no questions." },
      classic: { name: "Classic", desc: "Guess a hidden sentence one letter at a time." },
      peephole: { name: "Peephole", desc: "Guess while looking through a tiny window." },
      twoPlayer: { name: "Two-Player", desc: "One of you hides a sentence. The other guesses." },
      gibberish: { name: "Robot Gibberish", desc: "A silly jumble from Robo. Give it a go!" },
      journey: { name: "My Journey", desc: "See your rounds and discoveries so far." },
      history: { name: "History", desc: "Look back at the sentences you have played." },
      howToPlay: { name: "How to Play", desc: "A quick reminder of how to guess." },
      aboutRobo: { name: "About Robo", desc: "Meet Robo and find out how it learned." },
      settings: { name: "Settings", desc: "Sound, keyboard and more." },
      discoveries: { name: "My Discoveries", desc: "Badges you have found along the way." }
    }
  },

  /* ================================================================ onboarding (3 steps, <= 15 words each) */
  onboarding: {
    steps: {
      one: { title: "A secret", text: "A secret sentence is hiding." },
      two: { title: "Guess", text: "Tap the letter you think comes next." },
      three: { title: "Try again", text: "Not it? Try again. Right? The letter appears!" }
    },
    stepOf: "Step {n} of {max}",
    next: "Next",
    skip: "Skip",
    start: "Let's play!",
    adultsTitle: "A note for grown-ups",
    soundInvite: "Sounds are off. You can turn them on in Settings.",
    soundAsk: "Want Robo to make sounds?",
    soundYes: "Turn on",
    soundNo: "Maybe later",
    pictures: {
      one: "Robo waves beside a hidden sentence with a glowing question box.",
      two: "A finger taps the letter E on a small keyboard.",
      three: "Not this one? That key turns grey. The right letter pops in with a number 2."
    }
  },

  /* ================================================================ practice (first Classic round, GP-011) */
  practice: {
    title: "Quick practice",
    sentence: ["A CAT", "A DOG", "A PIG", "A HEN"],
    intro: "Let's try a tiny sentence first. Nothing is saved.",
    highlight: "The glowing box is the next letter. Which one is it?",
    input: "Tap a letter, or type it on your keyboard.",
    space: "Words have gaps. Use SPACE to guess a gap.",
    greyed: "Greyed-out letters are ones you already tried here.",
    done: "You're ready! Let's play a real sentence.",
    skip: "Skip practice",
    go: "Play a real sentence",
    replayHint: "You can do practice again from How to Play."
  },

  /* ================================================================ setup */
  setup: {
    title: "Get ready",
    modes: {
      classic: "Classic",
      peephole: "Peephole",
      twoPlayer: "Two-Player",
      gibberish: "Robot Gibberish"
    },
    modeIntro: {
      classic: "Guess the hidden sentence one letter at a time.",
      peephole: "You will only see a few of the letters before.",
      twoPlayer: "A friend hides a sentence. You guess it.",
      gibberish: "Robot gibberish! Let's see how you do."
    },
    tierHeading: "Choose a kind of sentence",
    tiers: {
      easy: { name: "Easy", desc: "Famous rhymes and sayings you may already know." },
      medium: { name: "Medium", desc: "Short story sentences about everyday things." },
      hard: { name: "Hard", desc: "Facts and longer words about our big wide world." },
      gibberish: { name: "Robot Gibberish", desc: "A jumble of letters from Robo. Anything can happen!" },
      surprise: { name: "Surprise me", desc: "Robo picks Easy, Medium or Hard for you." },
      custom: { name: "Secret sentence", desc: "A sentence your friend made up." }
    },
    pickAnother: "Pick another",
    change: "Change game",
    start: "Start",
    peek: {
      heading: "How far back can you peek?",
      intro: "Choose how many letters before the box you can see.",
      window: "a little window over the text",
      labels: {
        "0": "0 letters",
        "1": "1 letter",
        "2": "2 letters",
        "3": "3 letters",
        "5": "5 letters",
        "all": "All of them"
      },
      hints: {
        "0": "You see no earlier letters at all.",
        "1": "You see just the letter before.",
        "2": "You see the last 2 letters.",
        "3": "You see the last 3 letters.",
        "5": "You see the last 5 letters.",
        "all": "You see everything so far, like Classic."
      },
      experiment: "Try an experiment: play with 0, then 2, then all."
    }
  },

  /* ================================================================ play */
  play: {
    gotItIn: "Got it in {n}!",
    lettersFound: "{n} letters found",
    lettersFoundOne: "1 letter found",
    triesHere: "Tries on this letter: {n}",
    invalidKey: "Use letters or the space bar.",
    keyboardLabel: "Letter keys",
    spaceKey: "SPACE",
    spaceWord: "space",
    peekWindow: "You can see the last {k} letters.",
    peekWindowOne: "You can see the last letter.",
    peekWindowNone: "You can't see any earlier letters.",
    peekWindowAll: "You can see everything so far.",
    caption: "{mode} · {tier}",
    fog: { label: "Earlier letters are hidden in the fog." },

    /* feedback bands: GP-034/035, CT-044. Pools are picked without immediate repetition. */
    feedback: {
      first: [
        "First try!",
        "First try! You read my mind.",
        "Bullseye! First guess!",
        "Wow, straight in on the first try!",
        "You saw that one coming!",
        "Right away! You knew it.",
        "One guess, and there it is!",
        "Spot on, first time!",
        "You nailed it on the first try!",
        "First try again! Lovely reading."
      ],
      nice: [
        "Nice one!",
        "Good guess!",
        "Got it, and quickly!",
        "You worked that one out.",
        "Nice thinking!",
        "Yes! That clue helped.",
        "A couple of tries and there it is!",
        "You're getting the hang of it.",
        "That's the one!",
        "Well spotted!"
      ],
      tricky: [
        "Tricky one!",
        "Ooh, a tricky one! That letter was full of information!",
        "You stuck with it. Great!",
        "That one took some thinking.",
        "Tricky letter! You kept going.",
        "Nice patience. That was a hard one.",
        "You never gave up on that one!",
        "That letter was hiding well!",
        "Phew, a clever one. Well done!",
        "Hmm, that was a surprise, wasn't it?"
      ],
      sneaky: [
        "Whoa, that was sneaky!",
        "Wow, that letter was full of surprise!",
        "What a sneaky letter! You found it.",
        "That one fooled everybody!",
        "Great catch! That was a really sneaky letter.",
        "You found a super-sneaky letter!",
        "That letter was very hard to see coming.",
        "Hooray for sticking with it!",
        "A big surprise! And you stayed with it.",
        "Even Robo would be surprised by that one!"
      ]
    },
    notThis: [
      "Not this one. Try another!",
      "Not that one. Try another!",
      "Hmm, not this one.",
      "Not here. Try another letter!",
      "That one is not it. Keep going!",
      "No luck there. Try a different letter!",
      "Not this one, but now you know!",
      "That letter is not next. Try again!",
      "Nope, not this one. What else?"
    ],
    streak3: [
      "Three first tries in a row! Amazing!",
      "Three in a row on the first try! Wow!",
      "Three first tries in a row! Are you reading my mind?",
      "Wow, three first tries, one after another!",
      "Three first tries! You know this sentence well."
    ],
    wordDone: [
      "One word done!",
      "Word complete!",
      "That's a whole word!",
      "Another word found!",
      "Word found! On to the next.",
      "A word appears!",
      "Nice, that word is done.",
      "One more word found.",
      "Look at that word!",
      "You finished a word!"
    ],

    giveUp: {
      label: "Show me",
      countdown: "{n} more tries and I can show you",
      countdownOne: "1 more try and I can show you",
      confirmTitle: "Reveal this one?",
      confirmBody: "Robo helps count it, as if you'd kept guessing in Robo's order.",
      confirmYes: "Yes, show me",
      confirmNo: "Keep guessing",
      available: "Show me is ready if you want it.",
      peekedLabel: "Peeked",
      peekedAlt: "peeked",
      legend: "Peeked letter. Robo helped count it.",
      revealed: [
        "Smart peek. Now you know that letter.",
        "Good idea to peek! Now you know.",
        "Peeking is part of the game.",
        "Nice peek! On to the next letter.",
        "Now you know that one. Onwards!",
        "That letter was hiding well. Now it's found.",
        "Peeked! Robo helped count it.",
        "A good peek. Let's keep going!",
        "Everybody peeks sometimes. Here we go!",
        "That was a stubborn letter. Next one!"
      ]
    },

    tally: {
      title: "Your guesses",
      guesses: "Guesses so far: {n}",
      last: "Last letter: {n}",
      hide: "Hide tally",
      show: "Show tally"
    },

    pause: {
      label: "Pause",
      title: "Paused. Nothing changes while you rest.",
      resume: "Back to the game"
    },

    finished: {
      title: "You finished!",
      lines: [
        "You finished! Let's see what you discovered.",
        "All done! What a sentence!",
        "You found every letter!",
        "The whole sentence is yours!",
        "Sentence complete! Robo is cheering.",
        "Hooray, you finished!",
        "That was a great round! Let's see what it shows.",
        "You did it! Time to see what you found."
      ],
      sentenceLabel: "The sentence was",
      next: "Watch Robo play"
    },

    /* screen-reader announcements (UX-055/056) */
    aria: {
      keyFree: "Letter {letter}, not tried yet",
      keyUsed: "Letter {letter}, already tried",
      spaceFree: "Space, not tried yet",
      spaceUsed: "Space, already tried",
      wrong: "Not this one",
      right: "Correct. The letter {letter} took {n} guesses",
      rightOne: "Correct. The letter {letter} took 1 guess",
      revealed: "Peeked. The letter {letter} is revealed",
      finished: "Round finished",
      current: "Next letter. Make a guess.",
      revealedSoFar: "Revealed so far: {text}",
      blank: "blank"
    }
  },

  /* ================================================================ robo */
  robo: {
    about: {
      title: "About Robo",
      p1: "Robo is a letter-guessing robot. It learned by reading lots of children's stories.",
      p2: "Robo has never seen the sentences in this game, and it has never seen the ones you type.",
      p3: "Robo does not understand stories like a person does. It only learned which letters often come next.",
      close: "Got it"
    },
    alt: {
      neutral: "Robo looks friendly",
      happy: "Robo is happy",
      curious: "Robo is curious",
      cheering: "Robo is cheering",
      thinking: "Robo is thinking",
      sleepy: "Robo is resting",
      waving: "Robo is waving"
    },
    gibberishIntro: "Robot gibberish! Let's see how you do.",
    gibberishHard: "Gibberish is hard for everybody, even me!",
    remarks: {
      start: [
        "My turn to guess! Watch me go.",
        "Now I'll try the same sentence.",
        "Let's see how I get on!",
        "I have never seen this sentence. Here I go!"
      ],
      roboQuick: [
        "I've read that word a lot!",
        "I knew the {letter} in {word} was coming!",
        "I've seen {word} in lots of stories.",
        "Stories taught me that pattern.",
        "That letter pattern looked very familiar!"
      ],
      youQuick: [
        "You knew the {letter} in {word}. Great thinking!",
        "You used the meaning. I only see letters!",
        "That one was easy for you. I was surprised!",
        "Nice! You saw the {letter} in {word} coming.",
        "You guessed that faster than me!"
      ],
      same: [
        "We both guessed that one the same way.",
        "Same number of guesses on {word}!",
        "We think alike on this one."
      ],
      end: [
        "That was fun! Let's compare.",
        "Done! Two different ways of guessing.",
        "My turn is over. Let's see what we found!",
        "We both played. Now for the good part!"
      ]
    }
  },

  /* ================================================================ roboPlays */
  roboPlays: {
    title: "Robo's turn to guess",
    subtitle: "Robo plays the same sentence. It has never seen it before.",
    youRow: "Your guesses",
    roboRow: "Robo's guesses",
    youTotal: "You: {n} guesses",
    roboTotal: "Robo: {n} guesses",
    legendPeeked: "Peeked letter. Robo helped count it.",
    partialNote: "Robo plays only the letters you finished.",
    skip: "Skip",
    watchAgain: "Watch again",
    continue: "Continue",
    stepByStep: "Show step by step",
    bands: { b0: "1 guess", b1: "2 guesses", b2: "3 or 4", b3: "5 to 8", b4: "9 or more" },
    ariaSummary: "You needed {you} guesses in total. Robo needed {robo}."
  },

  /* ================================================================ board */
  board: {
    title: "What you discovered",
    header: {
      sentence: "The sentence was",
      sentenceHidden: "The sentence is a secret until you finish.",
      mode: "Mode",
      tier: "Kind",
      peek: "Peek {k}",
      peekAll: "Peek: all",
      letters: "{n} letters",
      guesses: "{g} guesses",
      peeked: "{r} peeked",
      tagPartial: "partial",
      tagReplay: "replay",
      revealedNote: "Robo helped count the {r} peeked letters.",
      revealedNoteOne: "Robo helped count the peeked letter.",
      lettersOne: "1 letter",
      guessesOne: "1 guess",
      showDetails: "Show the sentence and details",
      hideDetails: "Hide the details",
      partialBanner: "Partial round: your first {n} letters",
      replayNote: "You've seen this one. Remembering helps!",
      showRest: "Show me the rest"
    },
    rough: {
      tag: "rough",
      shortSentence: "short sentence",
      manyRevealed: "many letters peeked",
      partial: "partial round"
    },
    whyAbout: {
      button: "Why 'about'?",
      text: "One sentence is a small sample, so the numbers wobble a little from round to round."
    },
    estimate: "estimate",
    missing: "I couldn't find that round. Let's go back home.",
    ordinary: "An ordinary sentence you played: about {mid} bits per letter, about {pct}% predictable.",
    about: "about {x}",
    bitsPerLetter: "about {mid} bits per letter",
    range: "between {low} and {high}",
    notEnoughData: "Not enough data yet.",
    spotlight: "Look at this first",
    seenBefore: "Seen before",
    isNew: "New",
    cardOf: "Card {n} of {max}",
    nav: {
      nextCard: "Next card",
      prevCard: "Back",
      showAll: "Show all cards",
      oneAtATime: "One card at a time",
      quickView: "Quick view",
      fullView: "Full view",
      showAsWords: "Show as words",
      showPicture: "Show picture",
      gotIt: "Got it!",
      gotItDone: "Got it! (tap to undo)",
      backToHistory: "Back to History",
      jump: "Jump to a card",
      cards: "The nine cards",
      finish: "Finish",
      whatNext: "What would you like to do next?",
      goSpotlight: "Go to {title}"
    },
    after: {
      next: "Next sentence",
      again: "Play this again",
      change: "Change mode or tier",
      home: "Home",
      journey: "My Journey",
      swap: "Swap roles and go again"
    },
    grownUpLabel: "Grown-up corner",
    grownUpOpen: "Open the Grown-up corner",
    grownUpClose: "Close the Grown-up corner",
    formulaLabel: "Formula",
    legend: {
      title: "Key",
      b1: "1 guess",
      b2: "2 guesses",
      b3: "3 or 4 guesses",
      b4: "5 to 8 guesses",
      b5: "9 or more guesses",
      peeked: "Peeked letter (Robo helped count it)",
      space: "SPACE"
    },

    cards: {

      /* ----------------------------------------------------------- 1 surprise */
      surprise: {
        title: "The Surprise-o-meter",
        layer2: [
          "Some letters were easy to see coming, others were a surprise. Which one surprised you most?",
          "Which letters made you say WHAT? Which ones did you see coming?",
          "Bigger, warmer letters were bigger surprises. Can you spot them?",
          "Why do you think the {letter} in {word} took {g} guesses?",
          "What made the {letter} in {word} such a sneaky one?"
        ],
        most: "Most surprising",
        mostItem: "the {letter} in {word}, {g} guesses",
        mostItemPeeked: "the {letter} in {word}, {g} guesses (peeked)",
        least: "Least surprising",
        leastRun: "{n} first tries in a row, starting with the {letter} in {word}",
        leastFirst: "the {letter} in {word}, on your first try",
        leastLowest: "the {letter} in {word}, {g} guesses",
        tapHint: "Tap a letter to see its guess numbers.",
        tapDetail: "You: {you} guesses. Robo: {robo} guesses.",
        tapDetailPeeked: "You: {you} guesses (peeked). Robo: {robo} guesses.",
        tapTitle: "The {letter} in {word}.",
        tapCounts: "Guesses: you {you}, Robo {robo}.",
        tapCountsPeeked: "Guesses: you {you} (peeked), Robo {robo}.",
        mostItemOne: "the {letter} in {word}, 1 guess",
        mostItemSpaceOne: "the SPACE after {word}, 1 guess",
        mostItemSpace: "the SPACE after {word}, {g} guesses",
        mostItemSpacePeeked: "the SPACE after {word}, {g} guesses (peeked)",
        leastRunSpace: "{n} first tries in a row, starting with the SPACE after {word}",
        leastFirstSpace: "the SPACE after {word}, on your first try",
        leastLowestSpace: "the SPACE after {word}, {g} guesses",
        thin: "Not much to show yet. Play a few more letters!",
        gibberish: {
          line: "Almost every letter was a surprise.",
          layer2: [
            "Nearly every letter was a surprise. Why do you think that happened?",
            "Look at all those big, warm letters. What made this sentence so hard?"
          ]
        },
        alt: "Your sentence with each letter sized by its guess count. Most surprising: {most}. {firstTry} of {n} letters were first try.",
        grownUp: {
          term: "Self-information (surprisal)",
          formula: "I(x) = −log₂ p(x)",
          reading: "The rarer an outcome, the more bits of surprise it carries. A guess count is a rank-based stand-in for how unlikely the letter was: more guesses never means less surprise.",
          shannon: "Shannon (1948) defined information as surprise. The 1951 guessing game measures it with guess counts."
        }
      },

      /* ----------------------------------------------------------- 2 bit */
      bit: {
        title: "The Twenty-Questions Coin",
        layer2: [
          "A bit is one yes-or-no question. A smart question cuts the choices in half.",
          "How few yes-or-no questions do you need to find a secret letter? Try splitting the alphabet in half!",
          "Can you find a secret letter in fewer questions? Try asking about the middle.",
          "Your {letter} in {word} took {g} guesses. A surprise like that is worth lots of questions."
        ],
        definition: "A bit is one yes/no question.",
        maxFive: "A letter with no clues at all takes at most {worst} questions: about {max} bits.",
        link: "Your most surprising letter needed {g} guesses. A surprise like that is worth more bits.",
        example: "Example",
        noCases: "You haven't played Bit Detective yet. Here is an example.",
        playDetective: "Play Bit Detective",
        you: "You: {n} questions",
        halving: "Halving: {best}",
        average: "Your average: {avg} questions per case. With no clues: about {max}.",
        avgLabel: "your average: {avg}",
        youOne: "You: 1 question",
        linkOne: "Your most surprising letter needed 1 guess. A surprise like that is worth more bits.",
        thin: "Play Bit Detective to see your own questions here.",
        gibberish: {
          line: "With no clues, you need about {worst} questions per letter.",
          layer2: [
            "With no clues at all, every letter needs lots of questions. Why?",
            "Random letters give no hints. How many questions does each one need?"
          ]
        },
        alt: "A strip of {size} tiles. You asked {n} questions. Halving needs {best}. One bit is one yes or no question.",
        grownUp: {
          term: "Bit (binary digit)",
          formula: "questions = log₂ N",
          reading: "Finding one of N equally likely options takes log₂ N yes/no questions on average. For {size} symbols that is about {max}, and {worst} in the worst case.",
          shannon: "Shannon's 1948 paper made the bit the unit of information. The word is credited to John Tukey."
        }
      },

      /* ----------------------------------------------------------- 3 entropy */
      entropy: {
        title: "The Wow-per-Letter Score",
        layer2: [
          "If most of your letters took 1 or 2 guesses, your average surprise is small. Why were so many letters easy?",
          "If you share out all your wows, how many wows per letter is that? The most possible is {max}!",
          "Your score is a range, not one number. Why do you think it wobbles?",
          "How did the {letter} in {word} change your average?"
        ],
        numberLine: {
          title: "Your usual surprise per letter",
          about: "about {mid} bits per letter",
          range: "between {low} and {high}",
          refMax: "{max}: no clues at all (random letters)",
          refEnglish: "about 1: Shannon's estimate for long English text"
        },
        histogram: {
          title: "How many guesses each letter took",
          axis: "Guesses",
          tenPlus: "10 or more",
          count: "{n} letters",
          peekedHatch: "Hatched means peeked",
          axisNote: "Guesses needed. 10+ means 10 or more."
        },
        summaryEasy: "Most of your letters took 1 or 2 guesses.",
        summaryMixed: "Your letters took a mix of guesses.",
        summaryHard: "Many of your letters took lots of guesses.",
        wideRange: "The range is wide because the sentence is short.",
        thin: "Only a few letters so far, so the range is very wide.",
        gibberish: {
          line: "Your score sits near the top, close to the 'no clues' mark.",
          layer2: [
            "Your score is up near the top. Why can't anyone guess random letters?",
            "Look how spread out the bars are. What made every letter so hard?"
          ]
        },
        alt: "Your estimate is about {mid} bits per letter, between {low} and {high}. The most possible is {max}. Guess counts: {hist}.",
        grownUp: {
          term: "Entropy",
          formula: "H = −Σ p log₂ p",
          reading: "Entropy is the average surprise per symbol, largest (log₂ {size} ≈ {max}) when every symbol is equally likely. From guess-count frequencies q(j), the upper bound is −Σ q(j) log₂ q(j) and the lower bound is Σ j (q(j) − q(j+1)) log₂ j.",
          shannon: "In 'Prediction and Entropy of Printed English' (1951), Shannon found roughly 1 bit per letter for long English text."
        }
      },

      /* ----------------------------------------------------------- 4 context */
      context: {
        title: "The Clue Trail",
        layer2: [
          "Letters inside a word get easier because the earlier letters give clues. Can you see where it got easier?",
          "Why were the first letters of words so much harder than the rest? What clues did the earlier letters give you?",
          "Why do you think the first letter of each word was hardest?",
          "What clue helped you with the {letter} in {word}?"
        ],
        wordPos: {
          title: "Average guesses by place in the word",
          pos1: "1st letter",
          pos2: "2nd letter",
          pos3: "3rd letter",
          pos4: "4th or later",
          bar: "{avg} guesses ({n} letters)",
          notEnough: "not enough letters yet",
          note: "Spaces and peeked letters are not counted."
        },
        layer2Neutral: "What clues from the letters before helped you guess the next one?",
        firstHigher: "Your first letters took more guesses than your later ones: {first} against {later}.",
        firstSame: "Your first letters and later letters took about the same number of guesses.",
        firstLower: "This time your later letters took more guesses: {later} against {first}. That happens!",
        firstFallback: "Not enough letters to compare first letters and later ones yet.",
        curve: {
          title: "Robo's look-back line",
          intro: "Robo guessed stories it never read, peeking back 0, 1, 2 or more letters.",
          xLabel: "Letters Robo can peek back",
          yLabel: "Bits per letter (lower is easier)",
          xNone: "none",
          peeksRange: "1 to {to}: peeks back that many letters",
          allKey: "all: Robo's longest peek, {k} letters",
          knowsNothing: "knows nothing",
          common: "knows which letters are common",
          peeksBack: "peeks back {k}",
          all: "all",
          roboLine: "Robo on stories it never read",
          sentenceLine: "Robo on this sentence",
          shannonLine: "Shannon's own numbers (about)",
          yours: "Your rounds",
          nRounds: "{n} rounds",
          placeholder: "Your Peephole points go here",
          tryPeephole: "Try Peephole"
        },
        thisRound: "This round: you could peek back {k} letters.",
        thisRoundOne: "This round: you could peek back 1 letter.",
        thisRoundAll: "This round: you could see everything so far.",
        compareClassic: "Classic rounds: about {classic} bits. This round with peek {k}: about {this} bits.",
        yourPattern: {
          down: "Your rounds so far suggest that peeking back more gave you fewer guesses.",
          up: "Your rounds so far suggest that peeking back more did not help you this time.",
          flat: "Your rounds so far look about the same, whatever the peek.",
          caveat: "Different sentences have different difficulty, so this is only a hint."
        },
        thin: "Not enough letters in this round to compare yet.",
        thinWords: "This round has too few words to compare first letters with later ones.",
        gibberish: {
          line: "Looking back didn't help here.",
          layer2: [
            "Looking back didn't help here. Why do you think that is?",
            "The bars are about level. What does that say about the clues?"
          ],
          faint: "The faint line shows ordinary English for comparison."
        },
        alt: "First letters took {first} guesses on average and later letters took {later}. Robo's line goes from {k0} bits with no peeking to {kLast} bits with the longest peek.",
        grownUp: {
          term: "Conditional entropy",
          formula: "H(X | previous k symbols) ≤ H(X)",
          reading: "Knowing the preceding symbols can only lower the average surprise. A single symbol can still be more surprising in context (a rare letter after Q); only the average cannot rise.",
          shannon: "Shannon approximated English by looking back 0, 1, 2 and 3 letters: about {max}, 4.03, 3.32 and 3.1 bits (approximate). Language models use the same idea."
        }
      },

      /* ----------------------------------------------------------- 5 redundancy */
      redundancy: {
        title: "The Guessable Part",
        layer2: [
          "You could almost read the sentence without the faded letters. That's what 'predictable' means.",
          "How much of your sentence could you guess from clues alone? Is it half or more?",
          "Which faded letter, like the {letter} in {word}, could you have guessed without trying?",
          "Faded letters are easy to guess. Why do you think they were easy?"
        ],
        headline: "About {pct}% of this sentence was predictable",
        firstTries: "{a} of {n} letters on the first try",
        benefit: "Guessable letters help us read messy writing and spot typing slips.",
        reference: "Shannon thought long English text is about 75% guessable.",
        toggleHide: "Read it with the faint letters hidden",
        toggleShow: "Show all the letters",
        fade: {
          title: "Fading key",
          light: "1 guess: very faint",
          medium: "2 or 3 guesses: a little faint",
          solid: "4 or more guesses: solid",
          peeked: "Peeked letters never fade"
        },
        thin: "A very short sentence gives a very rough answer.",
        gibberish: {
          line: "Almost nothing was predictable.",
          layer2: [
            "Almost nothing faded away. Why can't random letters be guessed?",
            "Hardly any faint letters this time. What is different about gibberish?"
          ]
        },
        alt: "About {pct} percent of the sentence was predictable. {a} of {n} letters were first try.",
        grownUp: {
          term: "Redundancy",
          formula: "R = 1 − H / Hmax",
          reading: "Redundancy is the share of a text that is predictable. It is not waste: it lets us read messy handwriting, fix typos and solve crosswords.",
          shannon: "Shannon (1951) put English at roughly 75 percent redundant over long distances."
        }
      },

      /* ----------------------------------------------------------- 6 twin */
      twin: {
        title: "The Magic Twin",
        layer2: [
          "These few numbers are enough to bring the whole sentence back! Could a twin rebuild it from only numbers?",
          "Robo's twin gets only numbers. Can it write the sentence back?",
          "Watch the {letter} in {word} appear from just one number!",
          "How can a few numbers hold a whole sentence?"
        ],
        numbersLabel: "Robo's numbers",
        twinLabel: "Twin",
        onesOne: "1 of the {n} numbers is just 1. Small numbers are cheap to write down.",
        rebuiltLabel: "Rebuilt sentence",
        originalLabel: "Original sentence",
        step1: "The twin gets only these numbers.",
        step2: "For each number, the twin asks a copy of Robo for its guesses in order.",
        play: "Watch the twin",
        pause: "Pause",
        stepNext: "Next step",
        skip: "Skip to the end",
        replay: "Watch again",
        matches: "It matches!",
        mismatch: "Hmm, the twin built a different sentence. Robo will look into it.",
        whyRobo: "A twin of Robo thinks exactly like Robo, but nobody can think exactly like you.",
        yourStrip: "Your numbers",
        yourStripNote: "A twin with your brain could rebuild it from your numbers.",
        samePredictor: "The twin must think exactly like the one who guessed.",
        ones: "{b} of the {n} numbers are just 1. Small numbers are cheap to write down.",
        thin: "Even one letter works: the twin rebuilds it from one number.",
        gibberish: {
          line: "The twin still rebuilds it! But there are few 1s, so the numbers are about as long to write as the letters.",
          layer2: [
            "The twin can rebuild even gibberish! Why are there so few 1s?",
            "Same magic, but the numbers are bigger. Why do you think so?"
          ]
        },
        alt: "Robo's numbers: {numbers}. The twin rebuilt: {text}. {result}",
        grownUp: {
          term: "Message sufficiency (lossless prediction-based coding)",
          formula: "decode(encode(s)) = s",
          reading: "With a shared deterministic predictor and identical tie-breaking, the sequence of ranks is a reversible description of the text, so it carries all its information. A rank means something only relative to the predictor that made it.",
          shannon: "Shannon (1951) argued that an identical twin of the guesser can recover the text from the 'reduced text' of guess numbers. This is what licenses the entropy bounds."
        }
      },

      /* ----------------------------------------------------------- 7 enough (context sufficiency) */
      enough: {
        title: "Just Enough Peeking",
        layer2: [
          "Peeking one letter back helps a lot, but peeking far back helps less and less. Where does it stop mattering?",
          "How many letters back do you need to guess nearly as well as with everything? Where does the line go flat?",
          "Before the {letter} in {word}, how many letters back would you want to see?",
          "Each extra peek helps a little less. Why might that be?"
        ],
        headline: "After about {n} letters, peeking further back hardly helps.",
        headlineNoKnee: "Peeking back even further than this chart still helped.",
        shaded: "hardly any extra help",
        knee: "about {n} letters",
        kneeOne: "about 1 letter",
        headlineOne: "After about 1 letter, peeking further back hardly helps.",
        saving: "{from} to {to} letters saved about {saved} bits",
        yourPattern: {
          down: "Your rounds so far suggest that peeking back more gave you fewer guesses.",
          up: "Your rounds so far suggest that peeking back more did not help you this time.",
          flat: "Your rounds so far look about the same, whatever the peek.",
          caveat: "Different sentences have different difficulty, so this is only a hint."
        },
        thin: "Play a Peephole round to put your own points on this line.",
        gibberish: {
          line: "Peeking back never helped here. There was nothing to find.",
          layer2: [
            "Peeking back never helped. Why is there nothing to find in random letters?",
            "The line stays flat. What would you need to find a pattern?"
          ]
        },
        alt: "Peeking back helps until about {n} letters. After that, extra letters hardly help.",
        grownUp: {
          term: "Context sufficiency (diminishing returns)",
          formula: "H(X | previous k symbols) is non-increasing in k",
          reading: "As the look-back grows, conditional entropy falls and then levels off towards the entropy rate. More context never hurts on average, but each extra symbol helps less. This is a property of averages over lots of text, so one sentence may wobble.",
          shannon: "Shannon's letter-pair and letter-triple models show it: about 0.7 bit saved at each of the first two steps, about 0.22 at the next (approximate). The gain is called mutual information."
        }
      },

      /* ----------------------------------------------------------- 8 squeeze */
      squeeze: {
        title: "The Squeeze-o-matic",
        layer2: [
          "Easy-to-guess letters need fewer yes/no questions, so the whole sentence fits in a smaller message. How small?",
          "If a twin knows how you guess, how many bits would your sentence need? Compare the two bars!",
          "Which letters, like the {letter} in {word}, cost almost nothing to write down?",
          "Which bar is shorter? What made it shorter?"
        ],
        originalName: "Original size",
        squeezedName: "Squeezed size",
        roboName: "With Robo's numbers",
        computerName: "How a computer usually stores text",
        bitsValue: "{bits} bits",
        aboutBitsValue: "about {bits} bits",
        savedNote: "The dotted part is what we saved: about {saved} bits.",
        computerNote: "This bar uses its own, bigger scale.",
        codeBook: {
          caption: "A real code for your numbers",
          sizes: "A plain code needs {plain} bits. A real code made for your numbers needs {huffman} bits. The best possible on these numbers is about {ideal} bits. Setting up the shared guesser is not counted.",
          headers: { guess: "Guess number", code: "Code" }
        },
        original: "Original size: {orig} bits",
        squeezed: "Squeezed size: about {sq} bits",
        headline: "Your sentence could be squeezed to about {pct}% of its size",
        roboBar: "With Robo's numbers: about {robo} bits",
        roboCaption: "This is the size the Magic Twin could really use.",
        computerBar: "How a computer usually stores each letter: {bits8} bits",
        possible: "This is what is possible if we had a perfect guesser.",
        reversible: "Squeezed does not mean damaged. The twin can bring back every letter.",
        noSaving: "No saving this time.",
        thin: "A very short sentence gives a very rough size.",
        gibberish: {
          line: "Hardly any squeeze.",
          layer2: [
            "Hardly any squeeze! Why can't random letters be made smaller?",
            "The two bars are almost the same. What would help the second bar shrink?"
          ]
        },
        alt: "Original size {orig} bits. Squeezed size about {sq} bits, which is {pct} percent of the original.",
        grownUp: {
          term: "Data compression (source coding)",
          formula: "average code length ≥ H",
          reading: "On average a text cannot be stored in fewer bits per symbol than its entropy. A good predictor makes most ranks 1, which get short codes. This estimate is idealised: it ignores the cost of agreeing on the predictor in advance.",
          shannon: "Shannon's 1948 source coding theorem. File compressors are the same idea made practical."
        }
      },

      /* ----------------------------------------------------------- 9 robo (You vs Robo) */
      robo: {
        title: "You vs Robo",
        layer2: [
          "Robo and you played the same game. Who needed fewer guesses, and how did Robo get so good?",
          "Who guessed better on your sentence, you or Robo? Where was each of you quickest?",
          "You and Robo both met the {letter} in {word}. Who needed fewer guesses?",
          "Robo has read lots of stories. What do you know that Robo doesn't?"
        ],
        panel: {
          you: "You",
          robo: "Robo",
          total: "Total guesses: {n}",
          average: "Guesses per letter: {avg}",
          bits: "About {mid} bits per letter ({low} to {high})"
        },
        strip: {
          youFewer: "You needed fewer: {n}",
          same: "Same: {n}",
          roboFewer: "Robo needed fewer: {n}",
          note: "Peeked letters are not counted here."
        },
        verdictRobo: [
          "Robo has read lots of stories. You guessed from your own experience.",
          "Robo needed fewer guesses this time. It has read lots of stories!"
        ],
        verdictYou: [
          "You needed fewer guesses than Robo this time. Nice thinking!",
          "You guessed this one better than Robo. Great job!"
        ],
        verdictEven: [
          "About even. Two different ways of guessing, about the same result.",
          "About even! You and Robo are good guessing partners."
        ],
        neverSeen: "Robo has never seen this sentence.",
        line: {
          robo: "Robo needed fewer guesses on this sentence.",
          you: "You needed fewer guesses on this sentence.",
          even: "About even."
        },
        celebrate: "Robo has read lots of stories. You guessed from your own experience. Two good ways to guess!",
        peekNote: "Robo peeked back {k} letters too, so the comparison is fair.",
        peekNoteOne: "Robo peeked back 1 letter too, so the comparison is fair.",
        twoWays: "Two different ways of guessing. Let's compare!",
        llm: "Computers such as AI chatbots are trained by playing this exact game billions of times: guess the next piece of text.",
        thin: "Finish a few more letters to see who was quicker where.",
        gibberish: {
          line: "Neither of us can guess random letters.",
          layer2: [
            "Neither of us can guess random letters. Why is it so hard for both?",
            "You and Robo are about the same here. What does that tell you?"
          ]
        },
        alt: "You needed {you} guesses and Robo needed {robo}. You were quicker on {youFewer} letters, Robo on {roboFewer}, and {same} were the same.",
        grownUp: {
          term: "Cross-entropy (language model)",
          formula: "H(p, q) = −Σ p log₂ q ≥ H(p)",
          reading: "Cross-entropy is how surprised a model q is, on average, by text p it did not write. It never falls below the true entropy, and perplexity is 2 to the power H. Language models are trained to lower it by predicting the next token, a word piece rather than a letter.",
          shannon: "Shannon's 1951 experiment was the first test of how well any predictor, human or machine, can guess English."
        }
      }
    }
  },

  /* ================================================================ journey */
  journey: {
    title: "My Journey",
    intro: "A little diary of your guessing. It stays on this device.",
    empty: "No rounds yet. Play one and come back!",
    roundsPlayed: "Rounds played: {n}",
    chart: {
      title: "Your guessing over time",
      yLabel: "Bits per letter (estimate)",
      roboLine: "Robo on the same sentences (shows how hard they were)",
      roboShort: "Robo, same sentences",
      latest: "Showing your latest {n} rounds.",
      xLabel: "Your rounds, oldest to newest",
      yourLine: "You"
    },
    filters: {
      title: "Show",
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
      gibberish: "Robot Gibberish",
      peephole: "Peephole",
      twoPlayer: "Two-Player",
      includeExtra: "Include replays and partial rounds",
      empty: "No rounds of this kind yet."
    },
    roundsList: { title: "Rounds in this view" },
    trend: {
      tooEarly: "Too early to tell. Play a few more rounds!",
      down: "Your numbers have gone down.",
      up: "Your numbers have gone up a little. These sentences may have been tougher.",
      steady: "About steady.",
      caveat: "Sentences differ in difficulty, so this is only a hint."
    },
    best: {
      title: "Best rounds",
      caption: "Sentences differ in difficulty, so this is not a ranking of you.",
      row: "{sentence}: about {mid} bits per letter",
      beatRobo: "Fewer guesses than Robo",
      none: "Your best rounds will show up here."
    },
    concepts: {
      title: "Cards you have met",
      notOpened: "Not opened yet",
      opened: "Opened",
      gotIt: "Got it!"
    },
    peepholePanel: {
      title: "Peephole results",
      row: "Peek {k}: about {mid} bits, {n} rounds",
      rowOne: "Peek {k}: about {mid} bits, 1 round",
      empty: "No Peephole rounds yet. Try one!"
    },
    detectivePanel: {
      title: "Bit Detective",
      row: "{n} cases. Average {avg} questions. With no clues: about {max}.",
      rowOne: "1 case. Average {avg} questions. With no clues: about {max}.",
      empty: "No cases yet. Try Bit Detective!",
      play: "Play Bit Detective"
    },
    openBoard: "Open this Board",
    reset: "Reset my progress"
  },

  /* ================================================================ history */
  history: {
    title: "History",
    empty: "Rounds you play will show up here.",
    entry: "{date}: {mode}, {tier}",
    estimate: "About {mid} bits per letter. Robo: about {robo}.",
    guesses: "{g} guesses",
    tags: {
      partial: "partial",
      replay: "replay",
      peeked: "{r} peeked",
      twoPlayer: "Two-Player"
    },
    secret: "Secret sentence (shown once you finish)",
    open: "Open Board",
    remove: "Delete this round",
    removeConfirm: "Delete this round? This can't be undone.",
    removeYes: "Yes, delete",
    removeNo: "Keep it",
    trimmed: "Older rounds were tidied away to make room."
  },

  /* ================================================================ detective (Bit Detective) */
  detective: {
    title: "Bit Detective",
    goal: "Find my secret letter with as few questions as you can. It could even be SPACE!",
    question: "Is it before {letter}?",
    dividerAria: "Ask: is it before {letter}?",
    dividerOff: "This question would not help",
    yes: "Yes",
    no: "No",
    asked: "Questions so far: {n}",
    caseOf: "Case {n} of {max}",
    tileLeft: "Letter {letter}, still possible",
    tileOut: "Letter {letter}, ruled out",
    found: "Found it!",
    /* --- added by the Bit Detective screen (src/js/ui/screens/detective.js) --- */
    foundLine: "My secret letter was {letter}.",
    seeResult: "See how I did",
    possible: "Still possible: {n}",
    stripLabel: "The {size} letters: A to Z, then SPACE",
    pickHint: "Tap a letter to choose a question.",
    ask: "Ask",
    logTitle: "Your questions",
    logCount: "{from} → {to}",
    liveAnswer: "Is it before {letter}? {answer}. {n} still possible.",
    robo: {
      start: [
        "Which letter am I hiding? Ask away!",
        "Ready? Ask me a yes or no question.",
        "I've picked a letter. Can you find it?",
        "New case! Ask your first question."
      ],
      yes: [
        "Yes! My letter is before {letter}.",
        "Yes, it comes before {letter}.",
        "Yes! It's somewhere before {letter}."
      ],
      no: [
        "No. My letter is {letter} or later.",
        "No, it's {letter} or after.",
        "Not before {letter}. It's {letter} or later."
      ]
    },
    codeTitle: "Your answers as a secret code: 1 for yes, 0 for no",
    codeHalving: "Halving's answers",
    codeYou: "Your answers",
    codeAria: "{who}: {list}",
    trickFrame: "Is it before {letter}? Either way, only {a} or {b} are left.",
    trickAgain: "Show it again",
    trickLabel: "The middle trick, step by step",
    trickStill: "Step {n}",
    leave: {
      title: "Leave this case?",
      body: "Nothing is saved if you leave now.",
      keep: "Keep playing",
      leave: "Leave"
    },
    result: {
      title: "Case solved!",
      youOne: "You used 1 question.",
      robo: {
        good: [
          "Super sleuthing! That was as quick as halving.",
          "Brilliant questions! You matched halving.",
          "What a clever detective you are!"
        ],
        more: [
          "You found it! Let's see how halving does it.",
          "Case solved! Look how halving shrinks things.",
          "Nice work! Halving has a neat way to go faster."
        ]
      },
      you: "You used {n} questions.",
      best: "Halving needs {best}.",
      never: "Halving never needs more than {worst}.",
      pathYou: "Your path",
      pathHalving: "Halving path"
    },
    naming: "Each yes/no question is one bit. A secret letter with no clues takes about {worst} questions: about {max} bits.",
    trick: "Want a trick? Try the middle!",
    trickBody: "Ask about the middle letter. Whatever the answer, half the letters are gone!",
    trickButton: "Show me the trick",
    another: "Another case",
    toClassic: "Now try guessing a whole sentence!",
    setSummary: {
      title: "Three cases done!",
      line: "Your average: {avg} questions. With no clues, the best is about {max}."
    }
  },

  /* ================================================================ twoPlayer */
  twoPlayer: {
    title: "Two-Player",
    intro: "One of you hides a sentence. The other guesses it, one letter at a time.",
    roles: { setter: "Setter", guesser: "Guesser" },
    setter: {
      title: "Setter: type your secret sentence",
      hint: "Type something fun. Keep the screen to yourself!",
      placeholder: "Type here",
      nudge: "Please keep real names, addresses and phone numbers out of your sentence.",
      show: "Show my sentence",
      hide: "Hide my sentence",
      counter: "{n} characters. Needs {minLen} to {maxLen}.",
      preview: "This is how it will be played:",
      confirm: "This is the one",
      change: "Change it",
      iAmSetter: "I'm the Setter",
      lookAway: "Setter, type a secret sentence. Guesser, please look away!",
      check: "Check my sentence",
      lookWarning: "Only the Setter should look!"
    },
    hints: {
      empty: "Type a sentence to hide.",
      short: "Add a few more words. {need} more letters to go.",
      long: "That's a long one. Try cutting {cut} letters.",
      digits: "Please write numbers as words, like TEN.",
      blocked: "Let's try a different sentence.",
      mixItUp: "Mix it up a bit!",
      known: "Robo has read that one in its stories! Try your own sentence."
    },
    handoff: {
      title: "Pass the device",
      body: "Setter, pass the device to the Guesser. Please don't peek!",
      iAmGuesser: "I'm the Guesser",
      start: "Start",
      ready: "Ready? Press Start when you are."
    },
    guesserIntro: "Guess the secret sentence, one letter at a time!",
    secretSentence: "The secret sentence was",
    swap: "Swap roles and go again"
  },

  /* ================================================================ settings */
  settings: {
    title: "Settings",
    sound: "Sound effects",
    soundHint: "Sounds are off until you turn them on.",
    calmMotion: "Calm motion",
    calmMotionHint: "Less moving and flashing.",
    calm: { follow: "Follow my device", on: "On", off: "Off" },
    layout: "Keyboard order",
    layoutAbc: "A to Z",
    layoutQwerty: "QWERTY",
    bigKeys: "Bigger text and keys",
    highContrast: "High contrast",
    quietRobo: "Quiet Robo",
    quietRoboHint: "Robo only says the important things.",
    nickname: "Nickname (optional)",
    nicknameHint: "Up to 12 letters. It stays on this device.",
    nicknameBlocked: "Let's try a different nickname.",
    replayIntro: "Watch the intro again",
    replayPractice: "Do the practice again",
    version: "Version {v}",
    contentVersion: "Content version {c}",
    adultsTitle: "For grown-ups",
    adultsNote: "This game stays on your device. Nothing is sent anywhere.",
    reset: {
      button: "Reset my progress",
      question: "Erase all my rounds? This can't be undone.",
      detail: "This erases all your rounds, your journey, your Bit Detective cases and your card progress.",
      step1: "Yes, erase",
      keep: "Keep my progress",
      step2Title: "Are you sure?",
      step2Body: "Everything will be erased and the game will start fresh.",
      step2Confirm: "Erase everything",
      done: "All clear. Starting fresh!"
    },
    teachers: {
      title: "For teachers and parents",
      intro: "What this game is about, and some questions to talk about together. Nothing here is a test.",
      open: "Open for teachers and parents",
      close: "Close",
      /* Adult-facing: formal terms are allowed under grownUp. Questions are a LIST (all shown), not a pool. */
      grownUp: {
        goals: "The game lets a child discover the core ideas of information theory from their own guess counts before any names or formulas appear. Each idea has a card on the Discovery Board. Estimates from one short sentence are rough; ideas build up over many plays.",
        surprise: {
          name: "Surprise (self-information)",
          goal: "Rare or unexpected outcomes carry more information. Guess counts are a stand-in for surprise.",
          questions: [
            "Which letters surprised you most, and why?",
            "Is a rare letter always a surprise? Think of a common letter in an odd place.",
            "Does a big surprise mean you played poorly? Why not?"
          ]
        },
        bit: {
          name: "Bit",
          goal: "A bit is the answer to one fair yes/no question; halving finds an item fastest.",
          questions: [
            "How would you find a number from 1 to 100 using only yes/no questions?",
            "Why is 'Is it A? Is it B?' slower than asking about the middle?",
            "If you already know the answer to a question, how much do you learn from hearing it?"
          ]
        },
        entropy: {
          name: "Entropy",
          goal: "Average surprise per symbol, estimated here from guess-count frequencies as a range.",
          questions: [
            "If every letter took 1 guess, what would the average surprise be?",
            "Why is the score for random letters as high as it can be?",
            "Would two children get the same score on the same sentence? Why or why not?"
          ]
        },
        context: {
          name: "Context (conditional entropy)",
          goal: "What came before shifts the odds of what comes next, so average surprise falls.",
          questions: [
            "Why are first letters of words usually harder than later ones?",
            "What clues besides earlier letters help you guess: topic, meaning, rhythm?",
            "Can you think of a letter that is more surprising because of the clues before it?"
          ]
        },
        redundancy: {
          name: "Redundancy",
          goal: "The predictable share of a text; it is useful, not wasteful.",
          questions: [
            "Why can we still read a sentence with some letters missing?",
            "What does it let us do, because English is so predictable?",
            "What would a message with no predictable part look like?"
          ]
        },
        twin: {
          name: "Message sufficiency",
          goal: "Guess numbers plus an identical predictor are enough to rebuild the text exactly.",
          questions: [
            "Why does the twin need to think exactly like Robo?",
            "Could your guess numbers rebuild the sentence for a friend? What would they need?",
            "Does a list of numbers lose any of the sentence? How do we know?"
          ]
        },
        enough: {
          name: "Context sufficiency",
          goal: "Looking back helps, but with diminishing returns.",
          questions: [
            "How many letters back do you really use when you guess?",
            "Why might peeking further back help less and less?",
            "Where would you stop peeking if each peek cost something?"
          ]
        },
        squeeze: {
          name: "Compression",
          goal: "Good prediction means a shorter lossless description of the same text.",
          questions: [
            "Why does the squeezed message have fewer bits but the same meaning?",
            "Which kinds of text would squeeze the most, and which the least?",
            "How is this like a zip file on a computer?"
          ]
        },
        robo: {
          name: "Model versus human (cross-entropy)",
          goal: "Language models play this same game at scale and are scored by how surprised they are.",
          questions: [
            "How is Robo's way of guessing different from yours?",
            "Why can't we say Robo understands the sentence?",
            "What do you think a chatbot practises when it reads billions of sentences?"
          ]
        }
      }
    }
  },

  /* ================================================================ dialogs */
  dialogs: {
    quit: {
      title: "Leave this round?",
      body: "You can come back to it.",
      keep: "Keep playing",
      save: "Save for later",
      stop: "Stop here",
      seeBoard: "See my Board so far",
      stoppedShort: "No problem. Come back any time!",
      stopTitle: "Stop here?",
      partialBody: "You found enough letters for a Board. Want to see it?",
      justHome: "Just go home",
      tooShortBody: "This one's too short for a Board. Nothing is saved.",
      goHome: "Go home",
      saved: "Saved. Your round will be waiting."
    },
    resume: {
      title: [
        "Welcome back! Want to carry on?",
        "Hello again! Shall we carry on?",
        "Good to see you! Pick up where you stopped?",
        "You're back! Keep going?",
        "Welcome back! Your sentence is waiting.",
        "Robo waved hello! Carry on?",
        "There you are! Want to continue?",
        "Hi again! Your round is saved.",
        "Ready to carry on where you stopped?"
      ],
      keep: "Keep going",
      fresh: "Start fresh",
      twoPlayer: "A Two-Player round is waiting."
    }
  },

  /* ================================================================ help (How to Play) */
  help: {
    title: "How to Play",
    tabs: { how: "How to play", about: "About Robo", teachers: "For teachers and parents" },
    how: {
      intro: "The whole game in five steps.",
      guess: { title: "Guess the next letter", text: "A secret sentence is hiding. Tap or type the letter you think comes next." },
      grey: { title: "Not right? Try another", text: "If it is not the letter, its key turns grey, so you never pick it twice. Keep going until the letter pops in." },
      space: { title: "Spaces count too", text: "The gaps between words are guesses too. Use the big SPACE key to try one." },
      showMe: { title: "Stuck? Ask Show me", text: "After a few tries, Show me can reveal the letter for you." },
      board: { title: "Then see what you found", text: "When the sentence is done, Robo guesses it too. Then your Discovery Board shows what your guesses reveal." }
    }
  },

  /* ================================================================ charts (labels used by ui/charts.js) */
  charts: {
    yes: "Yes",
    headers: {
      item: "Item", value: "Value", series: "Line", lookBack: "Letters looked back", bits: "Bits per letter",
      question: "Question", possible: "Letters still possible", position: "Place", letter: "Letter",
      guesses: "Guesses", peeked: "Peeked", letters: "Letters"
    },
    tile: { one: "Letter {letter}, 1 guess", many: "Letter {letter}, {g} guesses", peekedSuffix: ", peeked" },
    compare: {
      you: "You needed fewer guesses",
      same: "Same number of guesses",
      robo: "Robo needed fewer guesses",
      revealed: "Peeked letter, not counted"
    }
  },

  /* ================================================================ errors */
  errors: {
    tripped: {
      title: "Oops! Robo tripped.",
      body: "Let's start again.",
      button: "Start again"
    },
    storageUnavailable: "I can't remember between visits on this device, but we can still play!"
  },

  /* ================================================================ badges (ids match src/js/core/badges.js) */
  badges: {
    title: "My discoveries",
    intro: "Badges are for trying things and finding ideas. Never for speed.",
    earned: "Earned {date}",
    notYet: "Not earned yet",
    newBadge: "New badge: {name}!",
    "shannon-starter": { name: "Shannon Starter", emoji: "🌟", how: "Finish your first guessing round." },
    "pattern-spotter": { name: "Pattern Spotter", emoji: "🧩", how: "Finish 5 rounds." },
    "bit-detective": { name: "Bit Detective", emoji: "🕵️", how: "Solve one Bit Detective case." },
    "surprise-spotter": { name: "Surprise Spotter", emoji: "😲", how: "Open the Surprise-o-meter card." },
    "context-champion": { name: "Context Champion", emoji: "🏆", how: "Finish a Peephole round." },
    "twin-maker": { name: "Twin Maker", emoji: "👯", how: "Watch the Magic Twin rebuild a sentence." },
    "squeeze-master": { name: "Squeeze Master", emoji: "🤏", how: "Open the Squeeze-o-matic card." },
    "gibberish-explorer": { name: "Gibberish Explorer", emoji: "🌪️", how: "Finish a Robot Gibberish round." },
    "robo-buddy": { name: "Robo Buddy", emoji: "🤖", how: "Open the You vs Robo card." },
    "grownup-peeker": { name: "Grown-up Peeker", emoji: "🔍", how: "Open a Grown-up corner." }
  }
};
