Pod::Spec.new do |s|
  s.name           = 'ExpoMakachatPush'
  s.version        = '0.1.0'
  s.summary        = 'MakaChat push inbox (App Group + NSE)'
  s.author         = 'Honga Yetu'
  s.homepage       = 'https://github.com/HongaYetu/makachat-js'
  s.license        = { :type => 'proprietary' }
  s.platforms      = { :ios => '13.4' }
  s.source         = { :git => '' }
  s.source_files   = '**/*.swift'
  s.dependency 'ExpoModulesCore'
end
