/* Canonical content for the Arda project.
   Sindarin + English per line; Tengwar is generated into data/tengwar.js
   by scripts/transcribe-tengwar.mjs and merged at runtime.
   Loaded as a plain global so the page works from file:// without fetch. */
(function (root) {
  root.ARDA_SONGS = [
    {
      id: "gwannad-i-lu",
      title: "Gwannad i-Lû",
      titleEn: "The Fading of Time",
      audio: "audio/gwannad-i-lu.mp3",
      lrc: "lyrics/gwannad-i-lu.lrc",
      duration: 226.12,
      sections: [
        { kind: "verse", lines: [
          { sin: "I laiss vallen dannar na-ceven fimp.", en: "The golden leaves fall to the grey earth." },
          { sin: "I sûl nalla mi 'lyf ring.", en: "The wind cries in the cold branches." },
          { sin: "Idhrinn anann gwanar na-dhae.", en: "Long years fade into the shadow." },
          { sin: "Rhîw dôl na-dhoer en-firiath.", en: "Winter comes to the lands of mortals." }
        ]},
        { kind: "verse", lines: [
          { sin: "Cair faen dartha mi lond.", en: "The White Ship waits at the harbour." },
          { sin: "Gaear can guren lom.", en: "The Sea calls my weary heart." },
          { sin: "Boe menin athar echor ardhon.", en: "I must go beyond the circles of the world." },
          { sin: "Suilad na-galad Anor.", en: "Farewell to the light of the Sun." }
        ]},
        { kind: "chorus", lines: [
          { sin: "Gwanon o-anann. Ú-ben arya Arda!", en: "I leave the long-past. No one inherits Arda!" },
          { sin: "Gwanon o-anann. Ú-ben arya Arda!", en: "I leave the long-past. No one inherits Arda!" }
        ]},
        { kind: "verse", lines: [
          { sin: "Faug na-ngalad. Sogon o-eithel Anor.", en: "Thirsty for light. I drink from the well of the Sun." },
          { sin: "Gwanon o-dû. Cuil fîr, dan ú-firin.", en: "I leave the night. Life fades, but I do not fade." }
        ]},
        { kind: "verse", lines: [
          { sin: "Cennin ernil rissar mi-dhû.", en: "I saw princes torn apart in the darkness." },
          { sin: "Gond danna na-ast.", en: "Stone falls to dust." },
          { sin: "Ross vith danna er henin.", en: "Grey rain falls upon my eyes." },
          { sin: "Athrad i-ngwellu.", en: "Crossing the death-shadow." }
        ]},
        { kind: "bridge", lines: [
          { sin: "Luitho naur, luitho lach.", en: "Quench the fire, quench the flame." },
          { sin: "Rif galu, ú-vatha nan.", en: "The bark grows, it feels nothing again." }
        ]},
        { kind: "chorus", lines: [
          { sin: "Gwanon o-anann. Ú-ben arya Arda!", en: "I leave the long-past. No one inherits Arda!" },
          { sin: "Gwanon o-anann. Ú-ben arya Arda!", en: "I leave the long-past. No one inherits Arda!" }
        ]},
        { kind: "outro", lines: [
          { sin: "Luitho naur…", en: "Quench the fire…" }
        ]}
      ]
    },
    {
      id: "i-dhae-odog",
      title: "I Dhae Odog",
      titleEn: "The Seventh Shadow",
      audio: "audio/i-dhae-odog.mp3",
      lrc: "lyrics/i-dhae-odog.lrc",
      duration: 128.56,
      sections: [
        { kind: "verse", lines: [
          { sin: "Darthon nan-eithel.", en: "I wait by the well." },
          { sin: "Darthon nan-Ithil.", en: "I wait by the Moon." },
          { sin: "Echuiol na-il dae.", en: "Waking at every shadow." },
          { sin: "Aníron den.", en: "I desire him." }
        ]},
        { kind: "verse", lines: [
          { sin: "Elin firiar.", en: "Stars fade." },
          { sin: "I-chrem glina.", en: "The insects sing." },
          { sin: "Guren danna…", en: "My heart falls…" },
          { sin: "Na-i-dhae odog.", en: "At the seventh shadow." }
        ]},
        { kind: "chorus", lines: [
          { sin: "Menel nalla.", en: "Heaven weeps." },
          { sin: "Faer nín gwedhinnen.", en: "My soul is bound." },
          { sin: "Calad nín thilia.", en: "My light flickers." },
          { sin: "Na-il glaw en-Ithil.", en: "At every radiance of the Moon." }
        ]},
        { kind: "bridge", lines: [
          { sin: "Risto Menel!", en: "Rend the Heavens!" },
          { sin: "Hado i-lond dû!", en: "Hurl night at the harbour!" },
          { sin: "An-iergon uireb.", en: "For my longing is eternal." },
          { sin: "Dan faer nín… fîr.", en: "But my soul… fades." }
        ]},
        { kind: "chorus", lines: [
          { sin: "Menel nalla.", en: "Heaven weeps." },
          { sin: "Faer nín gwedhinnen.", en: "My soul is bound." },
          { sin: "Calad nín thilia.", en: "My light flickers." },
          { sin: "Na-il glaw en-Ithil.", en: "At every radiance of the Moon." }
        ]}
      ]
    },
    {
      id: "i-dann-haer",
      title: "I Dann Haer",
      titleEn: "The Long Defeat",
      audio: "audio/i-dann-haer.mp3",
      lrc: "lyrics/i-dann-haer.lrc",
      duration: 164.96,
      sections: [
        { kind: "verse", lines: [
          { sin: "Renon enith rim.", en: "I remember many names." },
          { sin: "Mellon, gwanur, herves.", en: "Friend, kinsman, spouse." },
          { sin: "Si gwannanner.", en: "Now they have departed." },
          { sin: "Sui hith mi-sûl.", en: "Like mist in the wind." }
        ]},
        { kind: "verse", lines: [
          { sin: "I thaim thinnar.", en: "The halls grow grey." },
          { sin: "Lalaith nu-dhae.", en: "Laughter is under shadow." },
          { sin: "Laston nan-lam.", en: "I listen for a voice." },
          { sin: "Dan lost… ú-ew.", en: "But empty… no one." }
        ]},
        { kind: "chorus", lines: [
          { sin: "Cuil nín, ann.", en: "My life, long." },
          { sin: "Cuil dîn, thent.", en: "Their life, short." },
          { sin: "Darthon erui.", en: "I remain alone." },
          { sin: "Mi-dhû en-Amar.", en: "In the night of the World." }
        ]},
        { kind: "verse", lines: [
          { sin: "Gwanun matha.", en: "Death feels like—" },
          { sin: "Níniel ornoth.", en: "weeping without count." },
          { sin: "Gwanun matha.", en: "Death feels like—" },
          { sin: "Firith en-gwaleth.", en: "the fading of torment." }
        ]},
        { kind: "bridge", lines: [
          { sin: "Harn nín ú-nestanna.", en: "My wound is not healed." },
          { sin: "Na-dhûr en-ann-gwelu.", en: "By the darkness of long-fading." },
          { sin: "Erui… Erui…", en: "Alone… Alone…" }
        ]},
        { kind: "outro", lines: [
          { sin: "Amar… Erui…", en: "The World… Alone…" }
        ]}
      ]
    }
  ];
})(typeof window !== "undefined" ? window : globalThis);
