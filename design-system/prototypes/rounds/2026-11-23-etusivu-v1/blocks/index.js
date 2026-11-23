// The page: block ids in order. Only the conductor edits this file.
// A string is one block. { day, glimpses } is one story section: the day
// block's intro, the glimpses under one sticky product screen, the day's end.
// { roles } and { caps } are sections whose intro block is followed by the
// listed blocks.
export default [
  'hero',
  {
    day: 'alice-day',
    glimpses: [
      'alice-01-whats-waiting',
      'alice-02-northside-prices',
      'alice-03-october-receipts',
      'alice-04-market-video',
      'alice-05-shipping-banner',
      'alice-06-planning-memo',
      'alice-07-lunch-phone',
      'alice-08-returns-workers',
      'alice-09-december-newsletter',
      'alice-10-undo-one-page',
      'alice-11-wholesale-order-page',
      'alice-12-before-i-go',
    ],
  },
  { intro: 'roles-intro', roles: ['role-bob', 'role-kirsi', 'role-carol', 'role-dave', 'role-erin', 'role-frank'] },
  { intro: 'library-intro', caps: ['caps-video-sound', 'caps-pictures', 'caps-3d', 'caps-paper', 'caps-maps', 'caps-print', 'caps-data', 'caps-web'] },
  'install',
];
