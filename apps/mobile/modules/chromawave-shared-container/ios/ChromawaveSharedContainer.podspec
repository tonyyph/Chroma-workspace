Pod::Spec.new do |s|
  s.name           = 'ChromawaveSharedContainer'
  s.version        = '1.0.0'
  s.summary        = 'Reads and writes the App Group container the widget renders from.'
  s.description    = 'A local Expo module. See modules/chromawave-shared-container/index.ts.'
  s.author         = 'Chroma Wave'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'Proprietary' }
  # Matches the app's deployment target rather than raising it: WidgetKit has
  # been available since iOS 14 and nothing here needs more.
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
