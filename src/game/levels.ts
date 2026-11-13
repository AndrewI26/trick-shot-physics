import { G_EARTH, barrier, boxWalls, circle, rect, vec, type PhysicsLevel } from './physics';

/** Total holes planned. Holes not yet in LEVELS show as "Coming soon". */
export const TOTAL_HOLES = 6;

export interface Level extends PhysicsLevel {
  id: number;
  name: string;
  tagline: string;
  /** Background colour outside the course. */
  backdrop: string;
  /** Shown before the hole: the physics idea this hole is about. */
  intro: string[];
  /** Shown after sinking it: why things happened the way they did. */
  outro: string[];
  gravityLabel: string;
  /** Optional tip shown on the level's intro screen, before the physics box. */
  tip?: string;
  /** Short tip shown on screen while playing: why friction matters on this hole. */
  hint: string;
  /** Speed every shot leaves the tee at (px/s). Same every time — only direction is chosen. */
  launchSpeed: number;
}

export const LEVELS: Level[] = [
  // ─── 1 ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    name: 'Straight Shot',
    tagline: 'Things keep moving until something stops them',
    tip: 'The target is farther away on this level. At the bottom, find the menu to change what surface you want to use. Some surfaces will have more friction and some less.\n\nHere’s a tip: lower friction means less resistance to motion. Remember, a surface with fewer imperfections will hinder the movement less, allowing objects to travel farther before slowing down!',
    hint: 'Without friction the ball would never stop. Pick a surface that slows it down just enough to stop right on the bullseye.',
    gravity: G_EARTH,
    gravityLabel: 'Earth',
    base: 'green',
    launchSpeed: 420, // 8.4 m/s
    backdrop: '#2d5a27',
    course: { x: 60, y: 200, w: 880, h: 200 },
    tee: vec(130, 300),
    target: vec(850, 300),
    zones: [],
    walls: boxWalls(60, 200, 880, 200),
    bumpers: [],
    intro: [
      'Newton’s first law says a moving object keeps moving in a straight line at the same speed unless a force acts on it. So why does a golf ball ever stop?',
      'Friction. Where the ball touches the ground, the two surfaces rub together. That rubbing pushes against the ball’s motion and slowly turns its motion energy into heat.',
      'Every shot leaves at exactly the same speed. You only choose the direction. What you CAN control is the surface under the ball: switch it any time (even mid-roll) with the buttons or number keys. Too slippery and the ball slides right past the target; too grippy and it stops short. Only where it stops counts.',
      'Watch the graph after you shoot: on one surface the speed drops at a steady rate, because friction pushes back with the same strength the whole time. The acceleration arrow points backwards, opposite the motion.',
    ],
    outro: [
      'Did you notice the speed line dropped like a ramp? Its steepness depends on the surface: if you switched surfaces mid-roll, the line suddenly got steeper or flatter. Rougher ground pushes back harder, so the ball loses speed faster.',
      'Since the ball always starts at the same speed, the surface alone decides how far it goes. Less friction means a longer roll.',
      'The acceleration readout stayed almost constant on each surface. The ball was “accelerating” backwards. In physics, slowing down is still acceleration.',
    ],
  },
  // ─── 2 ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    name: 'Target Close',
    tagline: 'More friction, shorter roll',
    tip: 'On this level, the target is closer, so you need to choose a surface with more friction. This will help prevent your puck from going past the target.\n\nSliding friction force is a contact force that opposes the motion of an object. This means that the direction is opposite to the force applied to the object. In the basic model of dry sliding friction, friction is independent of the area of contact and of the sliding speed.',
    hint: 'The target is close but your shot is just as fast. Only a high-friction surface can slow the ball down in time to stop on it.',
    gravity: G_EARTH,
    gravityLabel: 'Earth',
    base: 'green',
    launchSpeed: 420, // 8.4 m/s, same as hole 1
    backdrop: '#2d5a27',
    course: { x: 60, y: 200, w: 880, h: 200 },
    tee: vec(130, 300),
    target: vec(610, 300), // 9.6 m from the tee, right up against the water
    // Overshoot and the ball rolls into the pond at the far end.
    zones: [{ shape: rect(700, 200, 240, 200), mat: 'water', label: 'WATER' }],
    walls: boxWalls(60, 200, 880, 200),
    bumpers: [],
    intro: [
      'The target is much closer this time, but your shot still leaves at the same speed. On a slippery surface the ball will race straight past it, and the pond at the end is waiting.',
      'To stop the ball in a short distance, you need a surface that pushes back hard: lots of friction. Rough surfaces like sandpaper are covered in tiny bumps that keep catching the ball and taking away its speed.',
      'Watch the speed graph: the more friction, the steeper the line drops and the sooner it hits zero.',
    ],
    outro: [
      'The ball always started with the same speed, so the only thing that decided where it stopped was friction. More friction means a bigger backward acceleration, so the ball runs out of speed sooner.',
      'Twice the friction stops the ball in about half the distance. That’s why emergency escape ramps for trucks are filled with loose gravel: it stops a runaway truck in a short distance.',
    ],
  },
  // ─── 3 ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    name: 'Target in the Middle',
    tagline: 'Friction turns motion into heat',
    tip: 'The target is right in the middle! Use what you just learned from the previous two levels to get the puck perfectly in the middle of the playing field.\n\nWhen friction acts on a moving object, some of its kinetic energy is transformed into thermal energy, aka heat. This is why surfaces and objects warm up when rubbing against each other. Energy is conserved, it does not disappear!',
    hint: 'The target is in the middle. A low-friction surface sends the ball past it, so use a higher-friction surface to stop it within the target.',
    gravity: G_EARTH,
    gravityLabel: 'Earth',
    base: 'green',
    launchSpeed: 420, // 8.4 m/s, same as every hole
    backdrop: '#2d5a27',
    course: { x: 60, y: 200, w: 880, h: 200 },
    tee: vec(130, 300),
    target: vec(500, 300), // middle of the playing field
    zones: [],
    walls: boxWalls(60, 200, 880, 200),
    bumpers: [],
    intro: [
      'The target is right in the middle of the playing field. Your shot leaves at the same speed as before, so the surface decides where the ball stops.',
    ],
    outro: [
      'When friction acts on a moving object, some of its kinetic energy is transformed into thermal energy, aka heat. This is why surfaces and objects warm up when rubbing against each other.',
      'Energy is conserved, it does not disappear! The ball’s motion energy didn’t vanish when it stopped; friction turned it into heat in the ball and the ground.',
    ],
  },
  // ─── 4 ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    name: 'The Funnel',
    tagline: 'Don’t fall in, or use the pull',
    tip: 'A funnel is on the surface. Try to make the object go around the funnel to get to the target.\n\nThe normal force acts perpendicular to the surface. In general, it affects the amount of friction between two surfaces, meaning that changing the object’s mass can also change the frictional force.\n\nHere’s a tip: as the object moves around the funnel, gravity pulls it toward the center and changes its direction. Friction also acts to slow it down, so choose the right surface and velocity to get around the funnel and reach the target!',
    hint: 'The funnel slopes down toward its centre, steeper the closer you get, so it pulls the ball in. Fall in the middle and the shot is over. Go around it, or skim its edge and let it curve the ball toward the target.',
    gravity: G_EARTH,
    gravityLabel: 'Earth',
    base: 'green',
    launchSpeed: 420, // 8.4 m/s, same as every hole
    backdrop: '#2d5a27',
    course: { x: 60, y: 100, w: 880, h: 400 },
    tee: vec(120, 300),
    target: vec(840, 300),
    zones: [{ shape: circle(480, 300, 150), mat: 'green', funnel: { strength: 140, pit: 22 } }],
    walls: boxWalls(60, 100, 880, 400),
    bumpers: [],
    intro: [
      'A giant funnel sits right between you and the target, like the coin spiral wishing wells you see at science centres.',
      'The funnel’s surface slopes down toward the middle. On a slope, part of gravity’s pull points downhill, so the ball gets tugged toward the centre. Near the rim the slope is gentle, but it gets steeper and steeper closer in, so the pull gets stronger.',
      'As the ball rolls inward it also speeds up, because its height is turning into motion. Aim straight at it and you’ll fall in. Skim the edge fast enough and the funnel just bends your path.',
    ],
    outro: [
      'Near the funnel, the acceleration arrow pointed toward the centre and grew as the ball got closer. That was gravity pulling it down the steepening slope.',
      'A ball moving fast enough sideways curves around the funnel instead of falling in, just like a coin spiralling in a wishing well, or a planet orbiting the Sun. Slow it down and the orbit shrinks until it falls in.',
    ],
  },
  // ─── 5 ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    name: 'Moving Target',
    tagline: 'Aim where it will be, not where it is',
    tip: 'Now you’re becoming an expert at this game! Let’s put your skills to the test: can you hit a moving target?\n\nDid you know that there are two main types of friction? Static friction prevents relative sliding between surfaces. This game focuses on kinetic friction. Think about how much effort it would take you to slide the puck in real life.',
    hint: 'The target is moving! Your ball takes time to get there, so aim for where the target will be, then switch surfaces to stop the ball just as the target slides under it.',
    gravity: G_EARTH,
    gravityLabel: 'Earth',
    base: 'green',
    launchSpeed: 420, // 8.4 m/s, same as every hole
    backdrop: '#24402f',
    course: { x: 60, y: 100, w: 880, h: 400 },
    tee: vec(120, 300),
    // Slides up and down the right side, there and back every 4 seconds.
    target: vec(810, 178),
    targetMotion: { to: vec(810, 422), period: 4 },
    zones: [],
    walls: boxWalls(60, 100, 880, 400),
    bumpers: [],
    barriers: [
      barrier(320, 200, 90, 22),
      barrier(320, 400, 90, 22),
      barrier(460, 300, 24, 110),
      barrier(590, 175, 80, 20),
      barrier(590, 425, 80, 20),
      barrier(660, 300, 22, 70),
    ],
    intro: [
      'Now you’re becoming an expert at this game! Let’s put your skills to the test: can you hit a moving target?',
      'Your ball takes time to cross the course. By the time it arrives, the target will have moved. So you can’t aim at where the target is now. You have to predict where it will be. Hunters, quarterbacks and soccer players do this all the time; it’s called leading the target.',
      'The target slows down as it reaches each end of its track, turns around, and is fastest in the middle. Where your ball stops is scored against wherever the target is at that exact moment.',
    ],
    outro: [
      'To hit a moving target you have to think about two motions at once: how long your ball takes to get there, and how far the target moves in that time.',
      'The target slowed down, stopped and sped up at each end, just like a swinging pendulum or a mass bouncing on a spring. The ends of its track are the easiest place to catch it because it’s moving slowest there.',
      'Switching surfaces let you control the ball’s timing, not just its distance: a grippy surface stops it sooner, a slippery one lets it glide until the target arrives.',
    ],
  },
  // ─── 6 ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    name: 'Air Streams',
    tagline: 'Moving air pushes things around',
    tip: 'Are you ready for this new challenge? Let’s consider what happens when air currents are introduced. The air currents can change the puck’s velocity and trajectory, pushing it away from its original path. Pay attention to the direction of the air currents to predict how they will affect the puck!',
    hint: 'Air streams push the ball the way they blow. Ride the upward stream into the one blowing right to reach the target, and watch out for the stream blowing the wrong way!',
    gravity: G_EARTH,
    gravityLabel: 'Earth',
    base: 'green',
    launchSpeed: 420, // 8.4 m/s, same as every hole
    backdrop: '#27465a',
    course: { x: 60, y: 100, w: 880, h: 400 },
    tee: vec(120, 430),
    target: vec(855, 180),
    zones: [
      { shape: rect(300, 100, 110, 400), mat: 'green', air: { v: vec(0, -300), k: 1.2 }, label: 'AIR ↑' },
      { shape: rect(480, 110, 280, 120), mat: 'green', air: { v: vec(320, 0), k: 1.2 }, label: 'AIR →' },
      { shape: rect(560, 340, 300, 140), mat: 'green', air: { v: vec(-300, 0), k: 1.2 }, label: '← AIR' },
    ],
    walls: boxWalls(60, 100, 880, 400),
    bumpers: [],
    barriers: [barrier(470, 330, 90, 22), barrier(700, 290, 80, 20)],
    intro: [
      'What if air currents could change the ball’s trajectory? Are you ready for this new challenge?',
      'Fans are blowing streams of air across the course. Each stream pushes the ball in the direction the air is moving.',
      'Air is made of tiny molecules. When moving air hits the ball, those molecules bump into it and push it along. The bigger the difference between the air’s speed and the ball’s speed, the harder the push. If the ball were moving along with the air, it would feel no push at all.',
      'A push changes the ball’s velocity in the direction of the push (Newton’s second law), so streams can speed the ball up, slow it down, or bend its path sideways.',
    ],
    outro: [
      'Inside each stream, the acceleration arrow pointed the way the air was blowing. That sideways push curved the ball’s path, and the stream blowing against you slowed it down.',
      'This is the same air resistance (drag) that slows a cyclist down, lets a sailboat move, and carries a leaf across a parking lot. Real golfers have to aim into the wind for the same reason.',
    ],
  },
];
