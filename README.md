# GRIB2 Weather forecast decoder

## Goals

View weather forecast data stored in GRIB2 format directly in the browser, without a server. The only backend component is a simple Cloudflare Worker proxy with a 1-hour cache used to download the files.

The initial goal was simply to build a JS/WASM decoder so users could easily read GRIB2 data without relying on specialized desktop tools like Panoply.

Then the visualization component was added gradually. This was an opportunity to have fun with caching large files in the browser using IndexedDB, implementing a cache update strategy to ensure the best possible user experience despite the large file sizes, parallelizing resource-intensive tasks with Web Workers, get all of this to work on mid-range smartphones, and tackling many other challenges.

## Experimentation with agent-based AI
This project started as an experiment aimed at creating a complex app without writing a single line of code. Claude Code, and later Codex, did everything, from source code to commit and push.

Overall, it allowed me to move very quickly on fairly complex tasks — sometimes in areas I barely knew anything about. It helped me validate unconventional ideas in a very short time. I now understand why people talk about AI-enhanced developers: for someone with experience, it can really feel like gaining superpowers. 🚀

I intentionally kept the agent setup simple, though I installed the Superpowers plugin, whose skills proved very useful.

At other times, the experience was frustrating and highlighted some limitations of agent-based coding, especially how quickly tokens are consumed with Claude Code + Claude Pro, then with Codex + ChatGPT Plus (though I personally feel I get more done before hitting the limit with the latter). I also realized that for frontend work, it was often faster to do things myself than spend time and tokens explaining needs the AI simply didn’t understand (🫣). I’ve seen quite a few disappointing examples where strong UI/UX skills, creativity, good taste, and a real perception of user experience are essential.

Going forward, I’m going to clean things up and continue more in a pair-programming mode than with a fully autonomous agent working from specs.

## TODO

### Fix
- [ ] depending on zoom level, moving the slider or playing the animation doesn't
- [ ] depending on zoom level, the weather layer is sometimes croped
- [ ] check 3D terrain resolution, mapterhorn source should be more precise in France

### Features
- [ ] add toggle 3D terrain on/off

### Doc
- [ ] check and update docs
- [ ] remove useless files (ex: old superpowers brainstorm plans)
