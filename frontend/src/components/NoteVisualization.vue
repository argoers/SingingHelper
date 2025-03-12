<template>
    <div class="visualizer-container">
        <canvas ref="canvas"></canvas>
    </div>
</template>

<script>
import { ref, onMounted, watch, computed } from "vue";
import { midiToNote } from "./ChartDisplay.vue"
import { getTimeSignature } from "../services/api";

export default {
    props: {
        midiNotes: Object, // ✅ Preloaded MIDI notes (full dataset)
        isRecording: Boolean, // ✅ Determines if animation is active
        tempo: Number,
        startBar: [Number, String],
        endBar: [Number, String],
    },
    setup(props) {
        const canvas = ref(null);
        let ctx = null;
        let notes = [];
        let animationFrameId;
        let beatsPerBar;
        let beatLength;
        let pxPerBeat;
        let pxPerSecond;
        let scrollSpeed;
        let firstNotePositionX = 200;
        let lastNotePositionX;
        let minNotePitch = Math.min(...props.midiNotes.map(e => e[2]));
        let startTime;
        let endTime;

        onMounted(async () => {
            canvas.value.width = 1300;
            canvas.value.height = 200;
            setUpNotes();
        });

        watch(
            () => props.isRecording,
            (isRecording) => {
                if (isRecording) {
                    animate();
                } else {
                    cancelAnimationFrame(animationFrameId);
                }
            }
        );

        const startBarComputed = computed(() => props.startBar);
        const endBarComputed = computed(() => props.endBar);
        const isRecordingComputed = computed(() => props.isRecording);
        const midiNotesComputed = computed(() => props.midiNotes);
        watch(midiNotesComputed, () => {
            minNotePitch = Math.min(...props.midiNotes.map(e => e[2]));
        })
        watch([isRecordingComputed, midiNotesComputed], () => {
            if (!isRecordingComputed.value) {
                setUpNotes();
            }
        });
        const setUpNotes = async () => {
            try {
                const data = await getTimeSignature();
                beatsPerBar = data.numerator;
                beatLength = data.denominator;
            } catch (error) {
                errorMessage.value = "Failed to fetch MIDI time signature.";
            }

            pxPerBeat = props.tempo * (4 / beatLength);
            pxPerSecond = (pxPerBeat * props.tempo) / 60;
            scrollSpeed = pxPerSecond / 60;
            ctx = canvas.value.getContext("2d");

            startTime = ((props.startBar - 1) * beatsPerBar) * (60 / props.tempo);
            endTime = (props.endBar * beatsPerBar) * (60 / props.tempo);
            lastNotePositionX = firstNotePositionX + (endTime - startTime) * pxPerSecond

            notes = props.midiNotes.map((note) => ({
                pitch: note[2],
                x: firstNotePositionX + (note[0] - startTime) * pxPerSecond, // Start at the right
                y: getYPosition(note[2]),
                width: (note[1] - note[0]) * pxPerSecond, // ✅ Stretch based on duration
                name: midiToNote(note[2]), // ✅ Store note name
            }));

            notes = notes.filter((note) => note.x < lastNotePositionX); // Remove off-screen notes

            if (props.isRecording) {
                animate();
            }
            drawStaticNotes();
        }

        const drawStaticNotes = () => {
            ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
            drawPlayhead(); // ✅ Always draw the playhead
            for (let i = 1; i * 10 < canvas.value.width; i++) {
                drawPlayhead(i);
            }
            notes = notes.filter((note) => note.x + note.width > firstNotePositionX); // Remove off-screen notes


            notes.forEach((note) => {
                drawNote(note);
            });
        };

        const drawNote = (note) => {
            ctx.fillStyle = "blue";
            ctx.fillRect(note.x, note.y, note.width, 20);

            // ✅ Draw note name above the note
            ctx.fillStyle = "black";
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.fillText(note.name, note.x + note.width / 2, note.y - 10);
        }
        const drawPlayhead = (i = 0) => {
            ctx.strokeStyle = i == 0 ? "red" : "grey"; // ✅ Red vertical line
            ctx.lineWidth = i == 0 ? 5 : 0.5;
            ctx.beginPath();
            //console.log(i, pxPerBeat, firstNotePositionX, i * pxPerBeat + firstNotePositionX)
            ctx.moveTo(i * pxPerBeat + firstNotePositionX, 0);
            ctx.lineTo(i * pxPerBeat + firstNotePositionX, canvas.value.height);
            ctx.stroke();
        };

        const animate = () => {
            if (!props.isRecording) return;
            ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
            drawPlayhead(); // ✅ Keep the playhead in place
            for (let i = 1; i * 10 < canvas.width; i++) {
                drawPlayhead(i);
            }
            notes.forEach((note) => {
                drawNote(note);
                note.x -= scrollSpeed; // Move left
            });

            notes = notes.filter((note) => note.x + note.width > 0); // Remove off-screen notes
            animationFrameId = requestAnimationFrame(animate);
        };

        const getYPosition = (midiNote) => {
            return canvas.value.height - (midiNote - minNotePitch + 2) * 10; // Middle C (MIDI 60) is centered
        };

        watch([startBarComputed, endBarComputed], async () => {
            if (!startBarComputed.value || !endBarComputed.value) return;
            setUpNotes();
        }
        );

        return { canvas };
    },
};
</script>

<style scoped>
.visualizer-container {
    width: 1300px;
    height: 200px;
    border: 1px solid black;
    overflow: hidden;
    background-color: white;
    /* ✅ Center Horizontally & Vertically */
    display: flex;
    justify-content: center;
    /* Centers horizontally */
    align-items: center;
    /* Centers vertically */
    margin: auto;
    margin-top: 50px;

}

canvas {
    width: 100%;
    height: 100%;
}
</style>