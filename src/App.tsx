import { useCallback, useEffect, useRef, useState } from "react";
import GameCanvas, { type Telemetry } from "./components/GameCanvas";
import LevelThumb from "./components/LevelThumb";
import { LEVELS, TOTAL_HOLES } from "./game/levels";
import {
	type Charge,
	type ShotResult,
	SURFACES,
	type SurfaceId,
	surfaceById,
	TARGET_RINGS,
} from "./game/physics";

const GAME_TITLE = "Trick Shot Physics";
import {
	clearProgress,
	loadProgress,
	type Progress,
	saveProgress,
} from "./game/progress";

type Phase =
	| "title"
	| "levels"
	| "intro"
	| "play"
	| "sunk"
	| "missed"
	| "final";

interface Result {
	points: number;
	ring: string;
	attempts: number;
	surface: SurfaceId;
}

const MAX_POINTS = TARGET_RINGS[0].points;

const EMPTY_TELEMETRY: Telemetry = {
	speed: 0,
	accel: 0,
	accelDir: 0,
	maxSpeed: 0,
	distance: 0,
	ground: "",
	friction: 0,
	moving: false,
	history: [],
};

function dirLabel(deg: number) {
	const dirs = ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"];
	return dirs[(Math.round(deg / 45) + 8) % 8];
}

export default function App() {
	const [phase, setPhase] = useState<Phase>("title");
	const [levelIdx, setLevelIdx] = useState(0);
	const [surfaceId, setSurfaceId] = useState<SurfaceId>("grass");
	const [attempts, setAttempts] = useState(0);
	const [results, setResults] = useState<(Result | undefined)[]>([]);
	// Completed levels + best scores, saved in localStorage (keyed by level id).
	const [best, setBest] = useState<Progress>(() => loadProgress());
	useEffect(() => saveProgress(best), [best]);
	const [shot, setShot] = useState<ShotResult | null>(null);
	const [run, setRun] = useState(0);
	const [showVectors, setShowVectors] = useState(true);
	/** Start page has two steps: welcome, then the friction primer. */
	const [titleStep, setTitleStep] = useState<0 | 1>(0);
	const [ballCharge, setBallCharge] = useState<1 | 0 | -1>(1);
	const [userCharges, setUserCharges] = useState<Charge[]>([]);
	const [placeMode, setPlaceMode] = useState<1 | -1 | null>(null);
	const [tel, setTel] = useState<Telemetry>(EMPTY_TELEMETRY);
	/** "Switch surfaces here" pointer: shown for 3 s at the start of each attempt. */
	const [showPointer, setShowPointer] = useState(false);
	useEffect(() => {
		if (phase !== "play") return setShowPointer(false);
		setShowPointer(true);
		const t = setTimeout(() => setShowPointer(false), 3000);
		return () => clearTimeout(t);
	}, [phase, run]);
	const pointerOn = showPointer && !tel.moving && tel.history.length === 0;

	const level = LEVELS[levelIdx];
	const surface = surfaceById(surfaceId);
	const attemptsRef = useRef(attempts);
	attemptsRef.current = attempts;

	/** Open a hole fresh (from the title, levels screen or "next hole"). */
	const openLevel = (i: number) => {
		setLevelIdx(i);
		setAttempts(0);
		setUserCharges([]);
		setPlaceMode(null);
		setPhase("intro");
	};

	/** Put the ball on the tee for a new attempt. */
	const startAttempt = () => {
		setShot(null);
		setRun((r) => r + 1);
		setTel(EMPTY_TELEMETRY);
		setPhase("play");
	};

	const onShotEnd = useCallback(
		(res: ShotResult) => {
			setShot(res);
			if (res.points > 0) {
				const r: Result = {
					points: res.points,
					ring: res.ring!.name,
					attempts: attemptsRef.current,
					surface: surfaceId,
				};
				setResults((s) => {
					const next = [...s];
					if (!next[levelIdx] || r.points > next[levelIdx]!.points)
						next[levelIdx] = r;
					return next;
				});
				const id = LEVELS[levelIdx].id;
				setBest((b) =>
					!b[id] || r.points > b[id].points ? { ...b, [id]: r } : b,
				);
				setTimeout(() => setPhase("sunk"), 1200);
			} else {
				setTimeout(() => setPhase("missed"), 1000);
			}
		},
		[surfaceId, levelIdx],
	);

	const nextHole = () => {
		if (levelIdx + 1 >= LEVELS.length) setPhase("final");
		else openLevel(levelIdx + 1);
	};

	const restartGame = () => {
		setResults([]);
		openLevel(0);
	};

	// Keys 1–5 switch the surface during play (even mid-roll).
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (phase !== "play") return;
			const n = Number(e.key);
			if (n >= 1 && n <= SURFACES.length) setSurfaceId(SURFACES[n - 1].id);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [phase]);

	const completed = LEVELS.map((l, i) => ({ l, i, r: results[i] })).filter(
		(x) => x.r,
	);
	const totalPoints = completed.reduce((a, x) => a + x.r!.points, 0);
	const allCleared = LEVELS.every((l) => best[l.id]);
	const showHud =
		phase === "intro" ||
		phase === "play" ||
		phase === "sunk" ||
		phase === "missed";

	return (
		<div className="app">
			<header className="topbar">
				<div className="brand">⛳ {GAME_TITLE}</div>
				{phase !== "title" && (
					<button className="small" onClick={() => setPhase("levels")}>
						☰ Levels
					</button>
				)}
				{showHud && (
					<div className="hud">
						<span>
							Hole <b>{level.id}</b>/{TOTAL_HOLES} · {level.name}
						</span>
						<span>
							Attempt{" "}
							<b>
								{Math.max(
									1,
									attempts + (phase === "play" && !tel.moving ? 1 : 0),
								)}
							</b>
						</span>
						<span>
							Surface: <b>{surface.name}</b>
						</span>
					</div>
				)}
			</header>

			<main className="layout">
				<div className="stage" onPointerDown={() => setShowPointer(false)}>
					<GameCanvas
						level={level}
						surface={surface}
						active={phase === "play"}
						showVectors={showVectors}
						holeKey={`${levelIdx}-${run}`}
						ballCharge={
							level.maxCharges || level.charges?.length ? ballCharge : 0
						}
						userCharges={userCharges}
						placeMode={level.maxCharges ? placeMode : null}
						onPlaceCharge={(p) =>
							setUserCharges((cs) => [...cs, { p, q: placeMode ?? 1 }])
						}
						onRemoveCharge={(i) =>
							setUserCharges((cs) => cs.filter((_, k) => k !== i))
						}
						onShot={() => setAttempts((a) => a + 1)}
						onShotEnd={onShotEnd}
						onTelemetry={setTel}
					/>

					{(phase === "play" || phase === "sunk" || phase === "missed") && (
						<>
							<section className="readouts hud-overlay">
								<div className="readout">
									<span className="label">Speed</span>
									<span className="value speed">{tel.speed.toFixed(1)}</span>
									<span className="unit">m/s</span>
								</div>
								<div className="readout">
									<span className="label">Acceleration</span>
									<span className="value accel">{tel.accel.toFixed(1)}</span>
									<span className="unit">
										m/s²{" "}
										{tel.moving && tel.accel > 0.2
											? dirLabel(tel.accelDir)
											: ""}
									</span>
								</div>
								<div className="readout small">
									<span className="label">Launch speed</span>
									<span className="value">
										{(level.launchSpeed / 50).toFixed(1)}
									</span>
									<span className="unit">m/s (fixed)</span>
								</div>
								<div className="readout small">
									<span className="label">Top speed</span>
									<span className="value">{tel.maxSpeed.toFixed(1)}</span>
									<span className="unit">m/s</span>
								</div>
								<div className="readout small">
									<span className="label">Distance</span>
									<span className="value">{tel.distance.toFixed(1)}</span>
									<span className="unit">m</span>
								</div>
								<div className="readout small">
									<span className="label">Rolling on</span>
									<span className="value">{tel.moving ? tel.ground : "—"}</span>
									<span className="unit">
										{tel.moving ? `friction ${tel.friction.toFixed(2)}` : ""}
									</span>
								</div>
								<div className="graph">
									<Sparkline history={tel.history} />
									<div className="legend">
										<span className="speed">■ speed</span>{" "}
										<span className="accel">■ acceleration</span>
									</div>
								</div>
							</section>
							<section className="controls hud-overlay">
								<div className="control-group surface-group">
									{pointerOn && (
										<div className="surface-pointer">
											Switch surfaces here, even mid-roll (keys 1–{SURFACES.length})
											<span className="arrow">⬇</span>
										</div>
									)}
									<span className="group-label">
										Surface (keys 1–{SURFACES.length})
									</span>
									<div
										className={`switcher ${pointerOn ? "pulse" : ""}`}
									>
										{SURFACES.map((s, i) => (
											<button
												key={s.id}
												className={s.id === surfaceId ? "selected" : ""}
												onClick={() => setSurfaceId(s.id)}
												title={`${s.name}: friction ${s.friction}`}
											>
												<span
													className="swatch"
													style={{ background: s.color, borderColor: s.edge }}
												/>
												<span>
													{i + 1}. {s.name}
												</span>
												<span className="sfric">{s.friction.toFixed(2)}</span>
											</button>
										))}
									</div>
								</div>
								{(level.maxCharges ?? 0) > 0 && (
									<div className="control-group">
										<span className="group-label">
											Charges · placed {userCharges.length}/{level.maxCharges}
										</span>
										<div className="charge-row">
											<span className="mini-label">Ball:</span>
											{([1, 0, -1] as const).map((q) => (
												<button
													key={q}
													className={`chip ${ballCharge === q ? "selected" : ""}`}
													onClick={() => setBallCharge(q)}
												>
													{q > 0
														? "+ Positive"
														: q < 0
															? "− Negative"
															: "Neutral"}
												</button>
											))}
										</div>
										<div className="charge-row">
											<span className="mini-label">Click to:</span>
											<button
												className={`chip ${placeMode === null ? "selected" : ""}`}
												onClick={() => setPlaceMode(null)}
											>
												🎯 Aim
											</button>
											<button
												className={`chip plus ${placeMode === 1 ? "selected" : ""}`}
												onClick={() => setPlaceMode(1)}
											>
												Place +
											</button>
											<button
												className={`chip minus ${placeMode === -1 ? "selected" : ""}`}
												onClick={() => setPlaceMode(-1)}
											>
												Place −
											</button>
											<button
												className="chip"
												onClick={() => setUserCharges([])}
												disabled={!userCharges.length}
											>
												Clear
											</button>
										</div>
									</div>
								)}
								<div className="control-group">
									<span className="group-label">Target points</span>
									<div className="rings">
										{TARGET_RINGS.map((r) => (
											<span key={r.name}>
												<i style={{ background: r.color }} /> {r.name}{" "}
												<b>{r.points}</b>
											</span>
										))}
									</div>
								</div>
								<div className="control-group">
									<label className="toggle">
										<input
											type="checkbox"
											checked={showVectors}
											onChange={(e) => setShowVectors(e.target.checked)}
										/>{" "}
										Show velocity (v) and acceleration (a) arrows
									</label>
									<p className="hint">
										Drag back and release to shoot. One shot, same speed every
										time. Switch surfaces to control where it stops.
									</p>
								</div>
							</section>
						</>
					)}

					{/* Hint shows while aiming, then gets out of the way once the ball is rolling */}
					{phase === "play" && !tel.moving && tel.history.length === 0 && (
						<div className="hint-banner">💡 {level.hint}</div>
					)}

					{phase === "title" && (
						<div className="overlay">
							<div className="card wide title-card">
								{titleStep === 0 && (
									<>
										<h1 className="title">Welcome to {GAME_TITLE}</h1>
										<p className="subtitle">
											Here you’ll be tested on your physics knowledge and your aim!
										</p>
										<p>
											The game consists of {LEVELS.length} exhilarating challenges
											where your goal is to slide the puck into the target using
											friction concepts. Our players call this game <i>gripping</i>,
											all thanks to the friction.
										</p>
										<p>
											Don’t have any previous friction knowledge? No worries! Before
											every level, take a moment to read the information box before
											trying your hand. Good luck!
										</p>
									</>
								)}
								{titleStep === 1 && <h2>Friction 101</h2>}
								{titleStep === 1 && (
									<div className="physics title-physics">
										<div>
											<h3>🔬 Same launch, every time</h3>
											<p>
												In every level, the object stays the same, and the launcher
												provides the same initial velocity. This allows the player to
												compare how different surfaces affect the puck’s motion. Once
												the puck is launched, sliding friction acts in the opposite
												direction of its motion, slowing it down. According to
												Newton’s Second Law, the net force acting on an object
												determines its acceleration. In this case, friction causes
												the puck to decelerate, gradually reducing its velocity until
												it comes to a stop.
											</p>
											<p>
												When you slide the object through the course, sliding
												friction works to oppose the object’s motion. Even if the
												puck is launched with the same force, the distance it travels
												will depend on the surface it moves across. Sliding friction
												is considered a resistance where two surfaces are in contact
												and move relative to one another.
											</p>
										</div>
										<div>
											<h3>🧱 Why surfaces are different</h3>
											<p>
												Surfaces have tiny bumps and imperfections. As they rub
												against each other, these bumps hinder the motion by
												interlocking. The <b>coefficient of friction</b> describes
												how much friction exists between two surfaces. It is the
												ratio of the frictional force to the normal force.
											</p>
											<p>
												Each surface has a different coefficient of friction. A
												higher coefficient of friction means a greater opposing
												friction force, causing the puck to slow down faster and
												travel a shorter distance. Conversely, a lower coefficient of
												friction means less resistance, allowing the puck to travel
												farther.
											</p>
										</div>
									</div>
								)}
								<div className="row">
									{titleStep === 0 ? (
										<>
											<button
												className="primary"
												onClick={() => setTitleStep(1)}
											>
												Next →
											</button>
											<button onClick={() => setPhase("levels")}>Levels</button>
										</>
									) : (
										<>
											<button onClick={() => setTitleStep(0)}>← Back</button>
											<button className="primary" onClick={() => openLevel(0)}>
												Play
											</button>
											<button onClick={() => setPhase("levels")}>Levels</button>
										</>
									)}
								</div>
							</div>
						</div>
					)}

					{phase === "levels" && (
						<div className="overlay">
							<div className="card xwide">
								<h2>Levels</h2>
								<p className="tagline">
									Pick any hole. Each one teaches a different physics idea.
									Completed: {LEVELS.filter((l) => best[l.id]).length}/
									{LEVELS.length}
								</p>
								<div className="levels">
									{Array.from({ length: TOTAL_HOLES }, (_, k) => k + 1).map(
										(id) => {
											const i = LEVELS.findIndex((x) => x.id === id);
											if (i < 0)
												return (
													<div key={`soon-${id}`} className="level-card soon">
														<div className="thumb placeholder">🔒</div>
														<div className="level-info">
															<div className="eyebrow">Hole {id}</div>
															<h3>Coming soon</h3>
															<p className="meta">
																This hole is still being designed.
															</p>
														</div>
													</div>
												);
											const l = LEVELS[i];
											return (
												<div key={l.id} className="level-card">
													<LevelThumb level={l} />
													<div className="level-info">
														<div className="eyebrow">
															Hole {l.id} · One shot
														</div>
														<h3>{l.name}</h3>
														<p className="tagline">{l.tagline}</p>
														<p className="meta">
															Launch speed{" "}
															{(l.launchSpeed / 50).toFixed(1)} m/s
															{l.bumpers.length + (l.barriers?.length ?? 0)
																? ` · ${l.bumpers.length + (l.barriers?.length ?? 0)} obstacles`
																: ""}
															{l.zones.some((z) => z.mat === "water")
																? " · water hazard"
																: ""}
															{l.zones.some((z) => z.slope) ? " · slope" : ""}
															{l.maxCharges
																? ` · magnets: place up to ${l.maxCharges}`
																: ""}
															{l.targetMotion ? " · moving target" : ""}
															{l.zones.some((z) => z.funnel) ? " · funnel" : ""}
															{l.zones.some((z) => z.air)
																? " · air streams"
																: ""}
														</p>
														<p className="meta">
															{best[l.id]
																? `✅ Completed · best ${best[l.id].points} pts (${best[l.id].ring}, on ${surfaceById(best[l.id].surface).name})`
																: "No points yet"}
														</p>
														<button
															className="primary"
															onClick={() => openLevel(i)}
														>
															Play hole {l.id}
														</button>
													</div>
												</div>
											);
										},
									)}
								</div>
								<div className="row">
									<button onClick={() => setPhase("title")}>
										Back to title
									</button>
									<button
										className={allCleared ? "primary" : ""}
										disabled={!allCleared}
										title={
											allCleared
												? ""
												: "Clear every level to unlock the conclusion"
										}
										onClick={() => setPhase("final")}
									>
										{allCleared ? "🎉 Show conclusion" : "🔒 Show conclusion"}
									</button>
									{Object.keys(best).length > 0 && (
										<button
											onClick={() => {
												clearProgress();
												setBest({});
											}}
										>
											Reset progress
										</button>
									)}
								</div>
							</div>
						</div>
					)}

					{phase === "intro" && (
						<div className="overlay">
							<div className="card wide">
								<div className="eyebrow">Hole {level.id} · One shot</div>
								<h2>{level.name}</h2>
								<p className="tagline">{level.tagline}</p>
								<div className="tip-box">
									{(level.tip ?? level.hint).split("\n\n").map((para, k) => (
										<p key={k}>
											{k === 0 ? "💡 " : ""}
											{para}
										</p>
									))}
								</div>
								<h3>Pick a starting surface</h3>
								<p className="meta">
									You can switch surfaces any time during play with the buttons
									on the right or keys 1–{SURFACES.length}.
								</p>
								<div className="surfaces">
									{SURFACES.map((s) => (
										<button
											key={s.id}
											className={`surface ${s.id === surfaceId ? "selected" : ""}`}
											onClick={() => setSurfaceId(s.id)}
										>
											<span
												className="swatch"
												style={{ background: s.color, borderColor: s.edge }}
											/>
											<span className="sname">{s.name}</span>
											<span className="sfric">Friction: {s.frictionLabel}</span>
											<span className="sblurb">{s.blurb}</span>
										</button>
									))}
								</div>
								<div className="row">
									<button className="primary" onClick={startAttempt}>
										Start on {surface.name} →
									</button>
								</div>
							</div>
						</div>
					)}

					{phase === "missed" && shot && (
						<div className="overlay">
							<div className="card center">
								<div className="eyebrow">
									Hole {level.id} · Attempt {attempts} · 0 points
								</div>
								<h2>
									{shot.hazard === "funnel"
										? "Fell in!"
										: shot.water
											? "Splash!"
											: shot.distance < 2
												? "Just missed!"
												: "Off target"}
								</h2>
								<p>
									{shot.hazard === "funnel"
										? "The funnel pulled the ball all the way down into the middle."
										: shot.water
											? "The ball rolled into the water."
											: `The ball stopped ${shot.distance.toFixed(1)} m from the bullseye, outside the target.`}
								</p>
								<p className="meta">
									Top speed {tel.maxSpeed.toFixed(1)} m/s · rolled{" "}
									{tel.distance.toFixed(1)} m. Every shot starts at the same
									speed, so try a different direction, or switch surfaces at a
									different moment to change where it stops.
								</p>
								<div className="row">
									<button className="primary" onClick={startAttempt}>
										Try again
									</button>
									<button onClick={() => setPhase("intro")}>
										Read the physics again
									</button>
								</div>
							</div>
						</div>
					)}

					{phase === "sunk" && shot && shot.ring && (
						<div className="overlay">
							<div className="card wide">
								<div className="eyebrow">
									Hole {level.id} · Attempt {attempts} · stopped{" "}
									{shot.distance.toFixed(2)} m from the centre
								</div>
								<h2>
									{shot.ring.name}! +{shot.points} points
								</h2>
								{results[levelIdx] &&
									results[levelIdx]!.points > shot.points && (
										<p className="meta">
											Your best on this hole is still{" "}
											{results[levelIdx]!.points} points.
										</p>
									)}
								<div className="physics">
									<h3>🔬 Why that happened</h3>
									{level.outro.map((t, i) => (
										<p key={i}>{t}</p>
									))}
									<p>
										<b>You finished on {surface.name}:</b> {surface.takeaway}
									</p>
								</div>
								<div className="row">
									<button className="primary" onClick={nextHole}>
										{levelIdx + 1 >= LEVELS.length
											? "See results"
											: "Next hole →"}
									</button>
									{shot.points < MAX_POINTS && (
										<button onClick={startAttempt}>Try for the bullseye</button>
									)}
									{allCleared && levelIdx + 1 < LEVELS.length && (
										<button onClick={() => setPhase("final")}>
											🎉 Show conclusion
										</button>
									)}
									<button onClick={() => setPhase("levels")}>Levels</button>
								</div>
							</div>
						</div>
					)}

					{phase === "final" && (
						<div className="overlay">
							<div className="card wide">
								{LEVELS.every((l) => best[l.id]) ? (
									<>
										<h2>🎉 You’ve done it! You’ve cleared all levels.</h2>
										<div className="tip-box conclusion">
											<p>
												Friction plays an important role in our everyday lives.
												Although it can sometimes work against us by slowing objects
												down, it is also essential for activities such as walking,
												gripping objects, and maintaining traction between car tires and
												the road. Without friction, many everyday activities would become
												extremely difficult!
											</p>
										</div>
										<h3>Your results</h3>
									</>
								) : (
									<>
										<h2>Results</h2>
										<p className="meta">
											Cleared {LEVELS.filter((l) => best[l.id]).length}/
											{LEVELS.length} levels. Finish the rest from the Levels
											screen to see the ending!
										</p>
									</>
								)}
								<table className="scorecard">
									<thead>
										<tr>
											<th>Hole</th>
											<th>Best ring</th>
											<th>Surface</th>
											<th>Points</th>
										</tr>
									</thead>
									<tbody>
										{completed.map(({ l, i, r }) => (
											<tr key={i}>
												<td>
													{l.id}. {l.name}
												</td>
												<td>{r!.ring}</td>
												<td>{surfaceById(r!.surface).name}</td>
												<td>{r!.points}</td>
											</tr>
										))}
										<tr className="total">
											<td>Total</td>
											<td>
												{completed.length}/{LEVELS.length} holes scored
											</td>
											<td />
											<td>
												{totalPoints} / {LEVELS.length * MAX_POINTS}
											</td>
										</tr>
									</tbody>
								</table>
								<div className="row">
									<button className="primary" onClick={restartGame}>
										Play again
									</button>
									<button onClick={() => setPhase("levels")}>Levels</button>
								</div>
							</div>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}

function Sparkline({
	history,
}: {
	history: { speed: number; accel: number }[];
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext("2d")!;
		const dpr = window.devicePixelRatio || 1;
		const W = (c.width = c.clientWidth * dpr);
		const H = (c.height = c.clientHeight * dpr);
		ctx.clearRect(0, 0, W, H);
		ctx.strokeStyle = "rgba(255,255,255,0.12)";
		ctx.lineWidth = 1;
		for (let i = 1; i < 4; i++) {
			ctx.beginPath();
			ctx.moveTo(0, (H * i) / 4);
			ctx.lineTo(W, (H * i) / 4);
			ctx.stroke();
		}
		if (history.length < 2) return;
		const max = Math.max(5, ...history.map((h) => Math.max(h.speed, h.accel)));
		const draw = (key: "speed" | "accel", color: string) => {
			ctx.strokeStyle = color;
			ctx.lineWidth = 2 * dpr;
			ctx.beginPath();
			history.forEach((h, i) => {
				const x = (i / 149) * W;
				const y = H - (h[key] / max) * (H - 4) - 2;
				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			});
			ctx.stroke();
		};
		draw("speed", "#2196f3");
		draw("accel", "#ff9800");
	}, [history]);
	return <canvas ref={ref} className="sparkline" />;
}
