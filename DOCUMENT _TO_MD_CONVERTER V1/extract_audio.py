import moviepy.editor as mp
import os

# Extract audio from video
video_path = 'input_docs/habit_to_make_mornings_better.mp4'
audio_path = 'input_docs/habit_to_make_mornings_better_audio.mp3'

if os.path.exists(video_path):
    print('Extracting audio from video...')
    video = mp.VideoFileClip(video_path)
    print(f'Video duration: {video.duration:.1f} seconds')
    video.audio.write_audiofile(audio_path, verbose=False, logger=None)
    print(f'Extracted audio to: {audio_path}')

    # Check file size
    size_mb = os.path.getsize(audio_path) / (1024 * 1024)
    print(f'Audio file size: {size_mb:.1f} MB')
else:
    print('Video file not found')