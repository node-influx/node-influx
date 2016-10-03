'use strict'

const Builder = require('../../lib/builder')

describe('builder', () => {
  const runTT = (Ctor, tt) => {
    tt.forEach((testCase, i) => {
      if (testCase.throws) {
        it(`throws on case #${i}`, () => {
          expect(e => testCase.expr(new Ctor()).toString()).to.throw(testCase.throws);
        });
      } else {
        it(`creates \`${testCase.val}\``, () => {
          expect(testCase.expr(new Ctor()).toString()).to.equal(testCase.val);
        });
      }
    });
  };

  describe('expression', () => {
    runTT(Builder.Expression, [
      {
        expr: e => e.field('foo').equals.value('bar'),
        val: '"foo" = \'bar\''
      },
      {
        expr: e => e.field('a"').equals.field('b').and.tag('a').equals.value(2),
        val: '"a\\"" = "b" AND "a" = 2'
      },
      {
        expr: e => e.field('a').equals.value('b\'ar'),
        val: '"a" = \'b\\\'ar\''
      },
      {
        expr: e => e.field('a').matches.value(/a\/b/),
        val: '"a" =~ /a\\/b/'
      },
      {
        expr: e => e.field('a').gt.value(new Date(1475121809184)),
        val: '"a" > "2016-08-04 04:03:29.184"'
      },
      {
        expr: e => e.field('a').equals.value(true),
        val: '"a" = TRUE'
      },
      {
        expr: e => e.field('a').equals.value({ toString: () => '9223372036854775807' }),
        val: '"a" = 9223372036854775807'
      },
      {
        expr: e => e.field('a').equals.value(null),
        throws: /doesn't know how to encode/
      }
    ]);
  });

  describe('measurement', () => {
    runTT(Builder.Measurement, [
      {
        expr: m => m.name('measure"ment'),
        val: '"measure\\"ment"'
      },
      {
        expr: m => m.name('measure"ment').policy('po"licy'),
        val: '"po\\"licy"."measure\\"ment"'
      },
      {
        expr: m => m.name('measure"ment').db('d"b'),
        val: '"d\\"b"."measure\\"ment"'
      },
      {
        expr: m => m.name('measure"ment').db('d"b').policy('po"licy'),
        val: '"d\\"b"."po\\"licy"."measure\\"ment"'
      }
    ]);
  });
});
