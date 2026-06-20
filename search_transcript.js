const fs = require('fs');
const readline = require('readline');

const transcriptPath = 'C:\\Users\\jesus\\.gemini\\antigravity-ide\\brain\\a70bc55b-c1cd-4ef8-957b-72a874a7ef07\\.system_generated\\logs\\transcript.jsonl';

const fileStream = fs.createReadStream(transcriptPath);

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

async function run() {
  const commands = [];
  for await (const line of rl) {
    if (line.includes('run_command')) {
      try {
        const json = JSON.parse(line);
        if (json.tool_calls) {
          for (const tc of json.tool_calls) {
             if (tc.function && tc.function.name === 'default_api:run_command') {
                const cmd = tc.function.arguments;
                if (cmd && cmd.CommandLine && cmd.CommandLine.startsWith('node ')) {
                  commands.push(cmd.CommandLine);
                }
             }
          }
        }
      } catch(e) {}
    }
  }
  console.log(commands.join('\n'));
}

run();
