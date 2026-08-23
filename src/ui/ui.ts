// Phase 1: proof-of-life only. Convert button sends a fixed message to the
// sandbox; the DOM walker / transformer pipeline arrives in Phase 2+.

const convertBtn = document.getElementById("convert-btn") as HTMLButtonElement;

convertBtn.addEventListener("click", () => {
  parent.postMessage(
    {
      pluginMessage: {
        type: "CONVERT_PROOF_OF_LIFE",
      },
    },
    "*"
  );
});
