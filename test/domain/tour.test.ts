import { describe, expect, it } from 'vitest';
import { freshTour, mergeTour, nextStep, readTour, stepPath, tourComplete, validateTour, withDone, withSeen, withVisit, STEP_TEXT, TOUR_STEPS, type Tour } from '../../shared/domain/tour';

// Getting started (D97): the rules behind the list. Five steps, Pick your Look last; a step never comes undone.

describe('Getting started', () => {
  it('has five steps, each with its words and where it takes you; the Look is last', () => {
    expect(TOUR_STEPS).toEqual(['product', 'places', 'friend', 'post', 'look']);
    for (const s of TOUR_STEPS) expect(STEP_TEXT[s].title && STEP_TEXT[s].sub && STEP_TEXT[s].path.startsWith('/') && STEP_TEXT[s].done).toBeTruthy();
  });

  it('a new account starts with nothing done, the list open and the welcome unseen', () => {
    expect(freshTour()).toEqual({ welcomed: false, view: 'open', done: [], visited: [], seen: [] });
    expect(freshTour(true).welcomed).toBe(true);
  });

  it('Strainz and Sources are one step, done once both have been opened, in either order', () => {
    const one = withVisit(freshTour(), 'sources');
    expect(one.done).toEqual([]);
    expect(stepPath(one, 'places')).toBe('/strainz');
    const other = withVisit(freshTour(), 'strainz');
    expect(stepPath(other, 'places')).toBe('/sources'); // the row takes you to the one you haven't seen
    expect(withVisit(one, 'strainz').done).toEqual(['places']);
    expect(withVisit(other, 'sources').done).toEqual(['places']);
  });

  it('steps keep the list’s order however they were done, and are counted once', () => {
    let t = withDone(withDone(freshTour(), 'look'), 'product');
    t = withDone(t, 'look');
    expect(t.done).toEqual(['product', 'look']);
    expect(nextStep(t)).toBe('places');
    expect(withSeen(withSeen(t, 'post'), 'add').seen).toEqual(['add', 'post']);
    expect(tourComplete(t)).toBe(false);
    expect(tourComplete(TOUR_STEPS.reduce(withDone, freshTour()))).toBe(true);
    expect(nextStep(TOUR_STEPS.reduce(withDone, freshTour()))).toBeNull();
  });

  it('checks a whole state and refuses anything it doesn’t know', () => {
    const good: Tour = { welcomed: true, view: 'small', done: ['post', 'product'], visited: ['strainz'], seen: ['add'] };
    expect(validateTour(good)).toEqual({ ok: true, value: { ...good, done: ['product', 'post'] } });
    for (const bad of [null, [], 'x', { ...good, view: 'gone' }, { ...good, done: ['product', 'flying'] }, { ...good, welcomed: 'yes' }, { ...good, seen: 'add' }, { ...good, visited: undefined }]) {
      expect(validateTour(bad).ok, JSON.stringify(bad)).toBe(false);
    }
    // Both places sent as visited: the step is done, whatever the sender worked out.
    expect((validateTour({ ...good, visited: ['strainz', 'sources'] }) as { value: Tour }).value.done).toEqual(['product', 'places', 'post']);
  });

  it('a save never unticks a step, a place or a hint, or brings the welcome back; only the view follows it', () => {
    const stored: Tour = { welcomed: true, view: 'open', done: ['product', 'post'], visited: ['strainz'], seen: ['add', 'friends'] };
    const stale: Tour = { welcomed: false, view: 'small', done: ['look'], visited: ['sources'], seen: ['look'] };
    expect(mergeTour(stored, stale)).toEqual({ welcomed: true, view: 'small', done: ['product', 'places', 'post', 'look'], visited: ['strainz', 'sources'], seen: ['add', 'friends', 'look'] });
  });

  it('reads back what’s stored, dropping what this build doesn’t know', () => {
    expect(readTour('not json')).toEqual(freshTour());
    expect(readTour('[1]')).toEqual(freshTour());
    expect(readTour(JSON.stringify({ welcomed: true, view: 'sideways', done: ['product', 'teleport'], visited: ['strainz', 'moon'], seen: ['add', 'x'], extra: 1 }))).toEqual({
      welcomed: true,
      view: 'open',
      done: ['product'],
      visited: ['strainz'],
      seen: ['add'],
    });
  });
});
