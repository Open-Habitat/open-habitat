% Silent Night (Stille Nacht): melody Franz Xaver Gruber, 1818; words Joseph
% Mohr, 1816, English by John Freeman Young, 1859. All public domain. The
% four-part setting was written for this page and is given to the public
% domain (CC0). Written in D major, as the choir's copy is: the sopranos'
% top note is a G. assets.mjs wraps this file once per book and key; a part
% book is a 160 x 120 mm page, the score an A5 one.

global = { \key d \major \time 6/8 \tempo "Gently" 4. = 46 }

soprano = \relative c'' {
  a8.( b16) a8 fis4. | a8.( b16) a8 fis4. | e'4 e8 cis4. | d4 d8 a4. |
  b4 b8 d8.( cis16) b8 | a8. b16 a8 fis4. | b4 b8 d8. cis16 b8 | a8. b16 a8 fis4. |
  e'4 e8 g8. e16 cis8 | d4.( fis4.) | d8( a) fis a8. g16 e8 | d2. \bar "|."
}

alto = \relative c' {
  fis8.( g16) fis8 d4. | fis8.( g16) fis8 d4. | g4 g8 g4. | fis4 fis8 fis4. |
  g4 g8 b8.( a16) g8 | fis8. g16 fis8 d4. | g4 g8 b8. a16 g8 | fis8. g16 fis8 d4. |
  g4 g8 g8. g16 g8 | fis4.( a4.) | fis4 d8 e8. e16 cis8 | d2. \bar "|."
}

tenor = \relative c' {
  a4 a8 a4. | a4 a8 a4. | cis4 cis8 e4. | d4 d8 d4. |
  d4 d8 d4 d8 | a8. a16 a8 a4. | d4 d8 d8. d16 d8 | a8. a16 a8 a4. |
  cis4 cis8 e8. e16 e8 | d2. | a4 a8 a8. a16 g8 | fis2. \bar "|."
}

bass = \relative c {
  d4 d8 d4. | d4 d8 d4. | a'4 a8 a4. | d,4 d8 d4. |
  g4 g8 g4 g8 | d8. d16 d8 d4. | g4 g8 g8. g16 g8 | d8. d16 d8 d4. |
  a'4 a8 a8. a16 a8 | d,2. | d4 d8 a8. a16 a8 | d2. \bar "|."
}

words = \lyricmode {
  Si -- lent night, ho -- ly night, all is calm, all is bright
  round yon vir -- gin mo -- ther and child, ho -- ly in -- fant so ten -- der and mild,
  sleep in hea -- ven -- ly peace, sleep in hea -- ven -- ly peace.
}

% A part book has three bars to a line, so the notes are large on a small page.
partBreaks = { \repeat unfold 3 { s2.*3 \break } s2.*3 }

\header {
  title = "Silent Night"
  composer = "Franz Xaver Gruber, 1818"
  poet = "Joseph Mohr, tr. J. F. Young"
  tagline = ##f
}

\paper {
  #(set! paper-alist (cons '("part" . (cons (* 160 mm) (* 120 mm))) paper-alist))
  #(set-paper-size "part")
  top-margin = 7\mm
  bottom-margin = 6\mm
  left-margin = 9\mm
  right-margin = 9\mm
  indent = 0
  ragged-last = ##f
  print-page-number = ##f
  system-system-spacing.basic-distance = #15
  ragged-bottom = ##f
}
