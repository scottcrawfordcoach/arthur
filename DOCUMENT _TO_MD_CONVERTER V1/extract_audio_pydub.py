from pydub import AudioSegment
import os

# Extract audio from video
video_path = 'input_docs/habit_to_make_mornings_better.mp4'
audio_path = 'input_docs/habit_to_make_mornings_better_audio.mp3'

if os.path.exists(video_path):
    print('Extracting audio from video...')
    try:
        # Load the video file
        audio = AudioSegment.from_file(video_path, format="mp4")
        print(f'Video duration: {len(audio)/1000:.1f} seconds')

        # Export as MP3
        audio.export(audio_path, format="mp3", bitrate="128k")
        print(f'Extracted audio to: {audio_path}')

        # Check file size
        size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        print(f'Audio file size: {size_mb:.1f} MB')

        if size_mb > 25:
            print('Warning: Audio file is still over 25MB limit. Consider using a shorter clip.')
        else:
            print('Perfect! Audio file is under 25MB limit for Whisper transcription.')

    except Exception as e:
        print(f'Error extracting audio: {e}')
        print('Make sure ffmpeg is installed. You can download it from https://ffmpeg.org/download.html')
else:
    print('Video file not found')