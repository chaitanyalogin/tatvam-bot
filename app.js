async function loadData(file) {
  const response = await fetch(`https://raw.githubusercontent.com/chaitanyalogin/tatvam-bot/refs/heads/main/data/${file}.json`);
  return response.json();
}

let about, jokes, memes, smalltalk;

async function init() {
  about = await loadData("about_chaitanya");
  jokes = await loadData("jokes");
  memes = await loadData("memes");
  smalltalk = await loadData("smalltalk");
}

init();
